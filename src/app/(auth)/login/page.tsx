import { signIn, auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string; error?: string }>;
}) {
  const session = await auth();
  if (session) redirect("/");

  const params = await searchParams;
  const successMsg = params.registered
    ? "Conta criada com sucesso! Faça login para continuar."
    : null;
  const errorMsg =
    params.error === "CredentialsSignin"
      ? "Email ou palavra-passe incorretos."
      : params.error === "unknown"
        ? "Ocorreu um erro. Tente novamente."
        : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Duedilis</h1>
          <p className="mt-2 text-sm text-gray-600">
            Plataforma de Fiscalização e Governança de Obra
          </p>
        </div>
        {successMsg && (
          <div className="rounded-md bg-green-50 border border-green-200 p-3">
            <p className="text-sm text-green-700">{successMsg}</p>
          </div>
        )}
        {errorMsg && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3">
            <p className="text-sm text-red-700">{errorMsg}</p>
          </div>
        )}
        <form
          action={async (formData: FormData) => {
            "use server";
            try {
              await signIn("credentials", {
                email: formData.get("email"),
                password: formData.get("password"),
                redirectTo: "/",
              });
            } catch (error) {
              if (error instanceof AuthError) {
                if (error.type === "CredentialsSignin") {
                  redirect("/login?error=CredentialsSignin");
                }
                redirect("/login?error=unknown");
              }
              // NEXT_REDIRECT thrown by Next.js on successful redirect — rethrow
              throw error;
            }
          }}
          className="space-y-4"
        >
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
          >
            Entrar
          </button>
        </form>
        <p className="text-center text-sm text-gray-600">
          Não tem conta?{" "}
          <a
            href="/register"
            className="inline-flex items-center justify-center min-h-[44px] px-2 font-medium text-blue-600 hover:text-blue-500"
          >
            Registar
          </a>
        </p>
      </div>
    </div>
  );
}
