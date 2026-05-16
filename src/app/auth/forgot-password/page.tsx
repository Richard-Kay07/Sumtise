"use client"

import { useState } from "react"
import { useSignIn } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Mail, Loader2, CheckCircle } from "lucide-react"

export default function ForgotPasswordPage() {
  const { isLoaded, signIn } = useSignIn()
  const router = useRouter()

  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isLoaded) return
    setError("")
    setLoading(true)

    try {
      await signIn.create({
        strategy: "reset_password_email_code",
        identifier: email,
      })
      setSent(true)
    } catch (err: any) {
      const msg = err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? "Failed to send reset email. Please try again."
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md shadow-xl border border-gray-100 rounded-2xl">
        <CardHeader className="text-center pb-2">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#50B0E020" }}>
              <Mail className="h-6 w-6" style={{ color: "#50B0E0" }} />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold" style={{ color: "#1A1D24" }}>
            {sent ? "Check your inbox" : "Forgot your password?"}
          </CardTitle>
          <CardDescription className="text-gray-500 mt-1">
            {sent
              ? `We've sent a reset code to ${email}`
              : "Enter your email and we'll send you a reset code"}
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4">
          {sent ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl border border-green-100">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                <p className="text-sm text-green-700">
                  Reset code sent! Check your spam folder if you don't see it within a minute.
                </p>
              </div>
              <Button
                className="w-full text-white font-semibold rounded-xl"
                style={{ backgroundColor: "#50B0E0" }}
                onClick={() => router.push(`/auth/reset-password?email=${encodeURIComponent(email)}`)}
              >
                Enter reset code
              </Button>
              <button
                className="w-full text-sm text-gray-500 hover:text-gray-700"
                onClick={() => { setSent(false); setError("") }}
              >
                Wrong email? Try again
              </button>
            </div>
          ) : (
            <form onSubmit={handleSend} className="space-y-4">
              <div>
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="mt-1 rounded-xl"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading || !email}
                className="w-full text-white font-semibold rounded-xl"
                style={{ backgroundColor: "#50B0E0" }}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset code"}
              </Button>

              <div className="text-center">
                <Link
                  href="/auth/signin"
                  className="inline-flex items-center gap-1 text-sm font-medium"
                  style={{ color: "#50B0E0" }}
                >
                  <ArrowLeft className="h-3 w-3" />
                  Back to sign in
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
