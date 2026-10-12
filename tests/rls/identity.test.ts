import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminSql,
  addMember,
  as,
  cleanup,
  createOrg,
  createUser,
  errorCode,
  type TestUser,
} from "./harness";

let alice: TestUser; // owner of org A
let bob: TestUser; // owner of org B
let carol: TestUser; // teacher in org A
let dave: TestUser; // admin in org A
let orgA: { id: string; slug: string };
let orgB: { id: string; slug: string };

beforeAll(async () => {
  [alice, bob, carol, dave] = await Promise.all([
    createUser("alice"),
    createUser("bob"),
    createUser("carol"),
    createUser("dave"),
  ]);
  orgA = await createOrg(alice, "a");
  orgB = await createOrg(bob, "b");
  await addMember(orgA.id, carol, "teacher");
  await addMember(orgA.id, dave, "admin");
});

afterAll(cleanup);

describe("signup trigger", () => {
  it("creates a profile with the full name from metadata", async () => {
    const [p] = await adminSql<
      { full_name: string }[]
    >`select full_name from public.profiles where id = ${alice.id}`;
    expect(p?.full_name).toBe("Test alice");
  });
});

describe("organizations isolation", () => {
  it("members see only their own orgs", async () => {
    const aliceOrgs = await as(alice, (tx) =>
      tx<{ id: string }[]>`select id from public.organizations`.then((r) =>
        r.map((x) => x.id),
      ),
    );
    expect(aliceOrgs).toContain(orgA.id);
    expect(aliceOrgs).not.toContain(orgB.id);

    const carolOrgs = await as(carol, (tx) =>
      tx<{ id: string }[]>`select id from public.organizations`.then((r) =>
        r.map((x) => x.id),
      ),
    );
    expect(carolOrgs).toEqual([orgA.id]);
  });

  it("guessing another org's id returns nothing (IDOR)", async () => {
    const rows = await as(
      alice,
      (tx) => tx`select * from public.organizations where id = ${orgB.id}`,
    );
    expect(rows).toHaveLength(0);
  });

  it("anon has no access at all", async () => {
    expect(
      await errorCode(as(null, (tx) => tx`select * from public.organizations`)),
    ).toBe("42501");
  });

  it("only owners can update settings", async () => {
    const byOwner = await as(
      alice,
      (tx) =>
        tx`update public.organizations set name = 'Renamed' where id = ${orgA.id} returning id`,
    );
    expect(byOwner).toHaveLength(1);

    for (const user of [carol, dave, bob]) {
      const rows = await as(
        user,
        (tx) =>
          tx`update public.organizations set name = 'Hijack' where id = ${orgA.id} returning id`,
      );
      expect(rows).toHaveLength(0);
    }
  });

  it("owners cannot change protected columns (slug, created_by)", async () => {
    expect(
      await errorCode(
        as(
          alice,
          (tx) =>
            tx`update public.organizations set slug = 'stolen-slug' where id = ${orgA.id}`,
        ),
      ),
    ).toBe("42501");
  });

  it("users cannot insert or delete organizations directly", async () => {
    expect(
      await errorCode(
        as(
          alice,
          (tx) =>
            tx`insert into public.organizations (name, slug, kind, country, timezone, currency, default_locale, week_start)
               values ('x', ${`t-x-${Date.now()}`}, 'individual', 'LK', 'UTC', 'LKR', 'en', 1)`,
        ),
      ),
    ).toBe("42501");
    expect(
      await errorCode(
        as(
          alice,
          (tx) => tx`delete from public.organizations where id = ${orgA.id}`,
        ),
      ),
    ).toBe("42501");
  });
});

describe("app.create_organization", () => {
  it("creates the org with the caller as active owner", async () => {
    const roles = await as(carol, async (tx) => {
      const [row] = await tx<{ id: string }[]>`select app.create_organization(
        'Carol Tutoring', ${`t-c-${Date.now()}`}, 'individual', 'GB', 'Europe/London', 'GBP', 'en-GB', 1::smallint
      ) as id`;
      return tx<
        { role: string; status: string }[]
      >`select role, status from public.memberships where org_id = ${row!.id} and user_id = ${carol.id}`;
    });
    expect(roles).toEqual([{ role: "owner", status: "active" }]);
  });

  it("rejects unknown timezones", async () => {
    expect(
      await errorCode(
        as(
          carol,
          (tx) => tx`select app.create_organization(
            'X', ${`t-tz-${Date.now()}`}, 'individual', 'GB', 'Mars/Olympus', 'GBP', 'en-GB', 1::smallint
          )`,
        ),
      ),
    ).toBe("22023");
  });

  it("is not callable by anon", async () => {
    expect(
      await errorCode(
        as(
          null,
          (tx) => tx`select app.create_organization(
            'X', 'anon-org', 'individual', 'GB', 'UTC', 'GBP', 'en', 1::smallint
          )`,
        ),
      ),
    ).toBe("42501");
  });
});

describe("memberships isolation", () => {
  it("teachers see only their own membership", async () => {
    const rows = await as(
      carol,
      (tx) => tx<{ user_id: string }[]>`select user_id from public.memberships`,
    );
    expect(rows.map((r) => r.user_id)).toEqual([carol.id]);
  });

  it("owners and admins see all memberships of their org only", async () => {
    for (const user of [alice, dave]) {
      const rows = await as(
        user,
        (tx) =>
          tx<
            { org_id: string }[]
          >`select org_id from public.memberships where org_id <> ${orgA.id} and user_id <> ${user.id}`,
      );
      expect(rows).toHaveLength(0);
      const own = await as(
        user,
        (tx) => tx`select 1 from public.memberships where org_id = ${orgA.id}`,
      );
      expect(own.length).toBe(3);
    }
  });

  it("nobody can write memberships directly (until M3 policies)", async () => {
    expect(
      await errorCode(
        as(
          alice,
          (tx) =>
            tx`insert into public.memberships (org_id, user_id, role) values (${orgA.id}, ${bob.id}, 'admin')`,
        ),
      ),
    ).toBe("42501");
    expect(
      await errorCode(
        as(
          carol,
          (tx) =>
            tx`update public.memberships set role = 'owner' where user_id = ${carol.id}`,
        ),
      ),
    ).toBe("42501");
  });

  it("an org cannot lose its last active owner", async () => {
    expect(
      await errorCode(
        adminSql`update public.memberships set role = 'admin' where org_id = ${orgB.id} and user_id = ${bob.id}`,
      ),
    ).toBe("P0001");
    expect(
      await errorCode(
        adminSql`delete from public.memberships where org_id = ${orgB.id} and user_id = ${bob.id}`,
      ),
    ).toBe("P0001");
  });
});

describe("profiles", () => {
  it("users read their own profile but not strangers'", async () => {
    const rows = await as(
      bob,
      (tx) => tx<{ id: string }[]>`select id from public.profiles`,
    );
    expect(rows.map((r) => r.id)).toEqual([bob.id]);
  });

  it("owners/admins can read profiles of their org's members; teachers cannot", async () => {
    const byAlice = await as(
      alice,
      (tx) =>
        tx<
          { id: string }[]
        >`select id from public.profiles where id = ${carol.id}`,
    );
    expect(byAlice).toHaveLength(1);

    const byCarol = await as(
      carol,
      (tx) =>
        tx<
          { id: string }[]
        >`select id from public.profiles where id = ${alice.id}`,
    );
    expect(byCarol).toHaveLength(0);
  });

  it("users update their own editable fields only", async () => {
    const own = await as(
      bob,
      (tx) =>
        tx`update public.profiles set full_name = 'Bobby', phone = '+447700900123' where id = ${bob.id} returning id`,
    );
    expect(own).toHaveLength(1);

    const other = await as(
      bob,
      (tx) =>
        tx`update public.profiles set full_name = 'Hacked' where id = ${alice.id} returning id`,
    );
    expect(other).toHaveLength(0);

    expect(
      await errorCode(
        as(
          bob,
          (tx) =>
            tx`update public.profiles set created_at = now() where id = ${bob.id}`,
        ),
      ),
    ).toBe("42501");
  });

  it("rejects phone numbers that are not E.164", async () => {
    expect(
      await errorCode(
        as(
          bob,
          (tx) =>
            tx`update public.profiles set phone = '0771234567' where id = ${bob.id}`,
        ),
      ),
    ).toBe("23514");
  });
});
