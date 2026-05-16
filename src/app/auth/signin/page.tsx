import { SignIn } from "@clerk/nextjs"
import Link from "next/link"

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 gap-4">
      <SignIn
        appearance={{
          elements: {
            footerAction: "hidden",
          },
        }}
        afterSignInUrl="/dashboard"
        signUpUrl="/auth/signup"
      />
      <p className="text-sm text-gray-500">
        <Link href="/auth/forgot-password" className="font-medium" style={{ color: "#50B0E0" }}>
          Forgot your password?
        </Link>
      </p>
    </div>
  )
}
