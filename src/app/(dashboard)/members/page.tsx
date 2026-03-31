import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { InviteMemberForm } from "./invite-form";
import { MembersList } from "./members-list";

export default async function MembersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const myMembership = await prisma.orgMembership.findFirst({
    where: { userId: session.user.id },
    include: { org: { select: { id: true, name: true } } },
  });

  if (!myMembership) redirect("/onboarding");

  const isAdmin = myMembership.role === "ADMIN_ORG";

  const members = await prisma.orgMembership.findMany({
    where: { orgId: myMembership.orgId },
    include: {
      user: { select: { id: true, name: true, email: true, createdAt: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const pendingInvites = isAdmin
    ? await prisma.orgInvite.findMany({
        where: {
          orgId: myMembership.orgId,
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <main className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Membros</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {myMembership.org.name}
          </p>
        </div>
      </div>

      <MembersList
        members={members.map((m) => ({
          id: m.id,
          userId: m.userId,
          role: m.role,
          name: m.user.name,
          email: m.user.email,
          joinedAt: m.createdAt,
          isCurrentUser: m.userId === session.user.id,
        }))}
        isAdmin={isAdmin}
      />

      {isAdmin && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Convidar Membro
          </h2>
          <InviteMemberForm />
        </div>
      )}

      {isAdmin && pendingInvites.length > 0 && (
        <div className="mt-8">
          <h2 className="text-base font-semibold text-gray-900 mb-3">
            Convites Pendentes
          </h2>
          <div className="space-y-2">
            {pendingInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between px-4 py-2.5 bg-white border rounded-lg"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {invite.email}
                  </p>
                  <p className="text-xs text-gray-500">
                    Expira em{" "}
                    {new Intl.DateTimeFormat("pt-PT", {
                      day: "2-digit",
                      month: "short",
                    }).format(invite.expiresAt)}
                  </p>
                </div>
                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-medium">
                  Pendente
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
