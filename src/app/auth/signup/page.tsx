import { SignUp } from "@clerk/nextjs"

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <SignUp
        afterSignUpUrl="/auth/verify-email"
        signInUrl="/auth/signin"
      />
    </div>
  )
}
