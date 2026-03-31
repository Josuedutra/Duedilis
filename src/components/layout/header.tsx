import { auth, signOut } from "@/lib/auth";

export async function Header() {
  const session = await auth();

  return (
    <header className="h-14 bg-white border-b flex items-center justify-between px-6">
      <div />
      {session?.user && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">{session.user.email}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="text-sm text-gray-500 hover:text-gray-900"
            >
              Sair
            </button>
          </form>
        </div>
      )}
    </header>
  );
}
