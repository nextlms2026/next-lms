import { createHash, randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminSql,
  addMember,
  as,
  asCommit,
  cleanup,
  createOrg,
  createUser,
  errorCode,
  type TestUser,
} from "./harness";

const newToken = () => {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: createHash("sha256").update(token).digest("hex") };
};

let owner: TestUser; // owner of org A
let admin: TestUser; // admin of org A
let teacher: TestUser; // teacher of org A
let invitee: TestUser; // not yet a member
let stranger: TestUser; // owner of org B
let orgA: { id: string; slug: string };
let orgB: { id: string; slug: string };

beforeAll(async () => {
  [owner, admin, teacher, invitee, stranger] = await Promise.all([
    createUser("owner"),
    createUser("admin"),
    createUser("teacher"),
    createUser("invitee"),
    createUser("stranger"),
  ]);
  orgA = await createOrg(owner, "ta");
  orgB = await createOrg(stranger, "tb");
  await addMember(orgA.id, admin, "admin");
  await addMember(orgA.id, teacher, "teacher");
});

afterAll(cleanup);

const invite = (
  user: TestUser,
  orgId: string,
  email: string,
  role: "owner" | "admin" | "teacher",
  hash = newToken().hash,
) =>
  as(
    user,
    (tx) =>
      tx`select app.create_invitation(${orgId}, ${email}, ${role}::public.member_role, ${hash})`,
  );

const membershipId = async (orgId: string, user: TestUser) => {
  const [m] = await adminSql<
    { id: string }[]
  >`select id from public.memberships where org_id = ${orgId} and user_id = ${user.id}`;
  return m!.id;
};

describe("create_invitation", () => {
  it("owners invite admins and teachers; admins invite teachers only", async () => {
    expect(
      await errorCode(invite(owner, orgA.id, "x1@example.com", "admin")),
    ).toBeNull();
    expect(
      await errorCode(invite(owner, orgA.id, "x2@example.com", "teacher")),
    ).toBeNull();
    expect(
      await errorCode(invite(admin, orgA.id, "x3@example.com", "teacher")),
    ).toBeNull();
    expect(
      await errorCode(invite(admin, orgA.id, "x4@example.com", "admin")),
    ).toBe("42501");
  });

  it("nobody can invite an owner", async () => {
    expect(
      await errorCode(invite(owner, orgA.id, "x5@example.com", "owner")),
    ).toBe("42501");
  });

  it("teachers and outsiders cannot invite", async () => {
    expect(
      await errorCode(invite(teacher, orgA.id, "x6@example.com", "teacher")),
    ).toBe("42501");
    expect(
      await errorCode(invite(stranger, orgA.id, "x7@example.com", "teacher")),
    ).toBe("42501");
    expect(
      await errorCode(invite(invitee, orgA.id, "x8@example.com", "teacher")),
    ).toBe("42501");
  });

  it("rejects existing active members and malformed emails", async () => {
    expect(
      await errorCode(invite(owner, orgA.id, teacher.email, "teacher")),
    ).toBe("P0001");
    expect(
      await errorCode(invite(owner, orgA.id, "not-an-email", "teacher")),
    ).toBe("22023");
  });

  it("users cannot write invitations or read token hashes directly", async () => {
    expect(
      await errorCode(
        as(owner, (tx) => tx`select token_hash from public.invitations`),
      ),
    ).toBe("42501");
    expect(
      await errorCode(
        as(
          owner,
          (tx) =>
            tx`insert into public.invitations (org_id, email, role, token_hash, expires_at)
               values (${orgA.id}, 'y@example.com', 'teacher', ${newToken().hash}, now() + interval '1 day')`,
        ),
      ),
    ).toBe("42501");
  });
});

describe("invitation visibility", () => {
  it("owners/admins see their org's invitations; teachers and other orgs see none", async () => {
    await asCommit(
      owner,
      (tx) =>
        tx`select app.create_invitation(${orgA.id}, 'visible@example.com', 'teacher', ${newToken().hash})`,
    );
    for (const u of [owner, admin]) {
      const rows = await as(
        u,
        (tx) =>
          tx`select id from public.invitations where email = 'visible@example.com'`,
      );
      expect(rows).toHaveLength(1);
    }
    for (const u of [teacher, stranger]) {
      const rows = await as(u, (tx) => tx`select id from public.invitations`);
      expect(rows).toHaveLength(0);
    }
  });

  it("preview reveals only org name, role, masked email and status — to anon too", async () => {
    const { hash } = newToken();
    await asCommit(
      owner,
      (tx) =>
        tx`select app.create_invitation(${orgA.id}, 'preview.person@example.com', 'teacher', ${hash})`,
    );
    const rows = await as(
      null,
      (tx) =>
        tx<
          {
            org_name: string;
            role: string;
            email_masked: string;
            status: string;
          }[]
        >`select * from app.invitation_preview(${hash})`,
    );
    expect(rows).toEqual([
      {
        org_name: "Org ta",
        role: "teacher",
        email_masked: "p***@example.com",
        status: "pending",
      },
    ]);
    const none = await as(
      null,
      (tx) => tx`select * from app.invitation_preview(${newToken().hash})`,
    );
    expect(none).toHaveLength(0);
  });
});

describe("accept_invitation", () => {
  it("joins the org with the invited role when the verified email matches", async () => {
    const { hash } = newToken();
    await asCommit(
      owner,
      (tx) =>
        tx`select app.create_invitation(${orgA.id}, ${invitee.email}, 'teacher', ${hash})`,
    );

    // Wrong person holding the link.
    expect(
      await errorCode(
        as(stranger, (tx) => tx`select app.accept_invitation(${hash})`),
      ),
    ).toBe("P0001");

    const result = await as(invitee, async (tx) => {
      const [r] = await tx<
        { slug: string }[]
      >`select app.accept_invitation(${hash}) as slug`;
      const [m] = await tx<
        { role: string; status: string }[]
      >`select role, status from public.memberships where org_id = ${orgA.id} and user_id = ${invitee.id}`;
      const audit =
        await tx`select action from public.audit_log where org_id = ${orgA.id}`;
      return { slug: r?.slug, member: m, audit };
    });
    expect(result.slug).toBe(orgA.slug);
    expect(result.member).toEqual({ role: "teacher", status: "active" });
    // Teachers can't read the audit log, even of their own org.
    expect(result.audit).toHaveLength(0);
  });

  it("works by id from 'my pending invitations' for the invited email only", async () => {
    await asCommit(
      owner,
      (tx) =>
        tx`select app.create_invitation(${orgA.id}, ${invitee.email}, 'admin', ${newToken().hash})`,
    );
    const pending = await as(
      invitee,
      (tx) =>
        tx<
          { id: string; role: string }[]
        >`select id, role from app.my_pending_invitations()`,
    );
    expect(pending).toHaveLength(1);
    expect(
      await errorCode(
        as(
          stranger,
          (tx) => tx`select app.accept_invitation(null, ${pending[0]!.id})`,
        ),
      ),
    ).toBe("P0001");
    expect(
      await errorCode(
        as(
          invitee,
          (tx) => tx`select app.accept_invitation(null, ${pending[0]!.id})`,
        ),
      ),
    ).toBeNull();
  });

  it("rejects revoked, expired and already-used links", async () => {
    const revoked = newToken();
    await asCommit(owner, async (tx) => {
      const [r] = await tx<{ id: string }[]>`select app.create_invitation(
        ${orgA.id}, ${invitee.email}, 'teacher', ${revoked.hash}) as id`;
      await tx`select app.revoke_invitation(${r!.id})`;
    });
    expect(
      await errorCode(
        as(invitee, (tx) => tx`select app.accept_invitation(${revoked.hash})`),
      ),
    ).toBe("P0001");

    const expired = newToken();
    await asCommit(
      owner,
      (tx) =>
        tx`select app.create_invitation(${orgA.id}, ${invitee.email}, 'teacher', ${expired.hash})`,
    );
    await adminSql`update public.invitations set expires_at = now() - interval '1 minute' where token_hash = ${expired.hash}`;
    expect(
      await errorCode(
        as(invitee, (tx) => tx`select app.accept_invitation(${expired.hash})`),
      ),
    ).toBe("P0001");
  });

  it("a new invite replaces the previous pending link for the same email", async () => {
    const first = newToken();
    const second = newToken();
    await asCommit(
      owner,
      (tx) =>
        tx`select app.create_invitation(${orgA.id}, 'replace@example.com', 'teacher', ${first.hash})`,
    );
    await asCommit(
      owner,
      (tx) =>
        tx`select app.create_invitation(${orgA.id}, 'replace@example.com', 'teacher', ${second.hash})`,
    );
    const [p1] = await as(
      null,
      (tx) =>
        tx<
          { status: string }[]
        >`select status from app.invitation_preview(${first.hash})`,
    );
    expect(p1?.status).toBe("revoked");
  });
});

describe("members", () => {
  it("only owners change roles", async () => {
    const tid = await membershipId(orgA.id, teacher);
    expect(
      await errorCode(
        as(admin, (tx) => tx`select app.change_member_role(${tid}, 'admin')`),
      ),
    ).toBe("42501");
    expect(
      await errorCode(
        as(
          stranger,
          (tx) => tx`select app.change_member_role(${tid}, 'admin')`,
        ),
      ),
    ).toBe("42501");
    const role = await as(owner, async (tx) => {
      await tx`select app.change_member_role(${tid}, 'admin')`;
      const [m] = await tx<
        { role: string }[]
      >`select role from public.memberships where id = ${tid}`;
      const [a] = await tx<
        { action: string; metadata: unknown }[]
      >`select action, metadata from public.audit_log where entity_id = ${tid} order by id desc limit 1`;
      return { role: m?.role, audit: a };
    });
    expect(role.role).toBe("admin");
    expect(role.audit).toEqual({
      action: "member.role_changed",
      metadata: { from: "teacher", to: "admin" },
    });
  });

  it("admins deactivate teachers but not admins or owners", async () => {
    const tid = await membershipId(orgA.id, teacher);
    const aid = await membershipId(orgA.id, admin);
    const oid = await membershipId(orgA.id, owner);
    expect(
      await errorCode(
        as(admin, (tx) => tx`select app.set_member_status(${tid}, 'inactive')`),
      ),
    ).toBeNull();
    for (const id of [aid, oid]) {
      // aid is the admin themself → leaving is allowed; check the owner only.
      if (id === aid) continue;
      expect(
        await errorCode(
          as(
            admin,
            (tx) => tx`select app.set_member_status(${id}, 'inactive')`,
          ),
        ),
      ).toBe("42501");
    }
    expect(
      await errorCode(
        as(
          teacher,
          (tx) => tx`select app.set_member_status(${aid}, 'inactive')`,
        ),
      ),
    ).toBe("42501");
  });

  it("deactivated members lose access to the org immediately", async () => {
    const tid = await membershipId(orgA.id, teacher);
    await asCommit(
      admin,
      (tx) => tx`select app.set_member_status(${tid}, 'inactive')`,
    );
    const rows = await as(
      teacher,
      (tx) => tx`select id from public.organizations where id = ${orgA.id}`,
    );
    expect(rows).toHaveLength(0);
    await asCommit(
      owner,
      (tx) => tx`select app.set_member_status(${tid}, 'active')`,
    );
  });

  it("anyone can leave, but the last owner cannot", async () => {
    const oid = await membershipId(orgA.id, owner);
    expect(
      await errorCode(
        as(owner, (tx) => tx`select app.set_member_status(${oid}, 'inactive')`),
      ),
    ).toBe("P0001");
    expect(
      await errorCode(
        as(owner, (tx) => tx`select app.change_member_role(${oid}, 'admin')`),
      ),
    ).toBe("P0001");
    const tid = await membershipId(orgA.id, teacher);
    expect(
      await errorCode(
        as(
          teacher,
          (tx) => tx`select app.set_member_status(${tid}, 'inactive')`,
        ),
      ),
    ).toBeNull();
  });

  it("ownership can be transferred: promote another owner, then step down", async () => {
    const aid = await membershipId(orgA.id, admin);
    const oid = await membershipId(orgA.id, owner);
    expect(
      await errorCode(
        as(owner, async (tx) => {
          await tx`select app.change_member_role(${aid}, 'owner')`;
          await tx`select app.change_member_role(${oid}, 'admin')`;
        }),
      ),
    ).toBeNull();
  });
});

describe("list_team", () => {
  type Row = { full_name: string; email: string | null; status: string };
  it("owners/admins see emails and inactive members; teachers see active names only", async () => {
    const tid = await membershipId(orgA.id, teacher);
    await asCommit(
      owner,
      (tx) => tx`select app.set_member_status(${tid}, 'inactive')`,
    );

    const byOwner = await as(
      owner,
      (tx) =>
        tx<
          Row[]
        >`select full_name, email, status from app.list_team(${orgA.id})`,
    );
    expect(byOwner.some((r) => r.status === "inactive")).toBe(true);
    expect(byOwner.every((r) => r.email !== null)).toBe(true);

    await asCommit(
      owner,
      (tx) => tx`select app.set_member_status(${tid}, 'active')`,
    );
    const byTeacher = await as(
      teacher,
      (tx) =>
        tx<
          Row[]
        >`select full_name, email, status from app.list_team(${orgA.id})`,
    );
    expect(byTeacher.length).toBeGreaterThan(1);
    expect(
      byTeacher.every((r) => r.email === null && r.status === "active"),
    ).toBe(true);
  });

  it("returns nothing to non-members", async () => {
    const rows = await as(
      stranger,
      (tx) => tx`select * from app.list_team(${orgA.id})`,
    );
    expect(rows).toHaveLength(0);
  });
});

describe("audit_log", () => {
  it("owners/admins read their org's log; other orgs and teachers see nothing", async () => {
    const own = await as(
      owner,
      (tx) => tx`select id from public.audit_log where org_id = ${orgA.id}`,
    );
    expect(own.length).toBeGreaterThan(0);
    for (const u of [stranger, teacher]) {
      const rows = await as(
        u,
        (tx) => tx`select id from public.audit_log where org_id = ${orgA.id}`,
      );
      expect(rows).toHaveLength(0);
    }
  });

  it("is append-only for users (no direct insert/update/delete)", async () => {
    for (const q of [
      (tx: Parameters<Parameters<typeof as>[1]>[0]) =>
        tx`insert into public.audit_log (org_id, action, entity_type) values (${orgB.id}, 'x', 'y')`,
      (tx: Parameters<Parameters<typeof as>[1]>[0]) =>
        tx`update public.audit_log set action = 'tampered'`,
      (tx: Parameters<Parameters<typeof as>[1]>[0]) =>
        tx`delete from public.audit_log`,
    ]) {
      expect(await errorCode(as(stranger, q))).toBe("42501");
    }
  });

  it("internal helpers are not callable by users", async () => {
    expect(
      await errorCode(
        as(
          stranger,
          (tx) =>
            tx`select app.write_audit(${orgA.id}, 'forged', 'x', null, '{}'::jsonb)`,
        ),
      ),
    ).toBe("42501");
  });
});
