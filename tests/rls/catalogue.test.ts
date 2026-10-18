import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addMember,
  adminSql,
  as,
  cleanup,
  createOrg,
  createUser,
  errorCode,
  type TestUser,
} from "./harness";

let owner: TestUser;
let admin: TestUser;
let teacher: TestUser;
let stranger: TestUser; // owner of org B
let orgA: { id: string; slug: string };
let orgB: { id: string; slug: string };

beforeAll(async () => {
  [owner, admin, teacher, stranger] = await Promise.all([
    createUser("cat-owner"),
    createUser("cat-admin"),
    createUser("cat-teacher"),
    createUser("cat-stranger"),
  ]);
  orgA = await createOrg(owner, "ca");
  orgB = await createOrg(stranger, "cb");
  await addMember(orgA.id, admin, "admin");
  await addMember(orgA.id, teacher, "teacher");
  await adminSql`insert into public.subjects (org_id, name) values (${orgA.id}, 'Physics'), (${orgB.id}, 'Secret B Subject')`;
  await adminSql`insert into public.grade_levels (org_id, name, sort_order) values (${orgA.id}, 'Grade 10', 10)`;
  await adminSql`insert into public.locations (org_id, name, kind) values (${orgA.id}, 'Main hall', 'hall')`;
});

afterAll(cleanup);

const TABLES = ["subjects", "grade_levels", "locations"] as const;

describe("catalogue read access", () => {
  it("every active member (incl. teachers) reads their org's catalogue", async () => {
    for (const user of [owner, admin, teacher]) {
      for (const table of TABLES) {
        const rows = await as(
          user,
          (tx) =>
            tx`select id from ${tx(`public.${table}`)} where org_id = ${orgA.id}`,
        );
        expect(rows.length, `${table} for user`).toBeGreaterThan(0);
      }
    }
  });

  it("other orgs and anon see nothing", async () => {
    const rows = await as(
      stranger,
      (tx) => tx`select name from public.subjects where org_id = ${orgA.id}`,
    );
    expect(rows).toHaveLength(0);
    const own = await as(
      owner,
      (tx) => tx<{ name: string }[]>`select name from public.subjects`,
    );
    expect(own.map((r) => r.name)).not.toContain("Secret B Subject");
    expect(
      await errorCode(as(null, (tx) => tx`select * from public.subjects`)),
    ).toBe("42501");
  });
});

describe("catalogue writes", () => {
  it("owners and admins add and edit", async () => {
    for (const user of [owner, admin]) {
      const rows = await as(user, async (tx) => {
        await tx`insert into public.subjects (org_id, name) values (${orgA.id}, 'Chemistry')`;
        await tx`insert into public.grade_levels (org_id, name, sort_order) values (${orgA.id}, 'Grade 11', 11)`;
        await tx`insert into public.locations (org_id, name, kind) values (${orgA.id}, 'Online', 'online')`;
        return tx`update public.subjects set name = 'Physics (A/L)' where org_id = ${orgA.id} and name = 'Physics' returning id`;
      });
      expect(rows).toHaveLength(1);
    }
  });

  it("teachers cannot add or edit", async () => {
    expect(
      await errorCode(
        as(
          teacher,
          (tx) =>
            tx`insert into public.subjects (org_id, name) values (${orgA.id}, 'Biology')`,
        ),
      ),
    ).toBe("42501");
    const updated = await as(
      teacher,
      (tx) =>
        tx`update public.subjects set name = 'Hacked' where org_id = ${orgA.id} returning id`,
    );
    expect(updated).toHaveLength(0);
  });

  it("nobody can write into another org (insert check / update filter)", async () => {
    expect(
      await errorCode(
        as(
          owner,
          (tx) =>
            tx`insert into public.subjects (org_id, name) values (${orgB.id}, 'Injected')`,
        ),
      ),
    ).toBe("42501");
    const updated = await as(
      owner,
      (tx) =>
        tx`update public.subjects set name = 'Hijacked' where org_id = ${orgB.id} returning id`,
    );
    expect(updated).toHaveLength(0);
  });

  it("rows cannot be moved to another org or deleted", async () => {
    expect(
      await errorCode(
        as(
          owner,
          (tx) =>
            tx`update public.subjects set org_id = ${orgB.id} where org_id = ${orgA.id}`,
        ),
      ),
    ).toBe("42501");
    expect(
      await errorCode(
        as(
          owner,
          (tx) => tx`delete from public.subjects where org_id = ${orgA.id}`,
        ),
      ),
    ).toBe("42501");
  });

  it("names are unique among active items; archiving frees the name", async () => {
    expect(
      await errorCode(
        as(
          owner,
          (tx) =>
            tx`insert into public.subjects (org_id, name) values (${orgA.id}, 'PHYSICS')`,
        ),
      ),
    ).toBe("23505");
    expect(
      await errorCode(
        as(owner, async (tx) => {
          await tx`update public.subjects set archived_at = now() where org_id = ${orgA.id} and name = 'Physics'`;
          await tx`insert into public.subjects (org_id, name) values (${orgA.id}, 'Physics')`;
        }),
      ),
    ).toBeNull();
  });
});
