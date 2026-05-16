"use client"

import { useState, useEffect } from "react"
import { useSignUp } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MailCheck, Loader2, CheckCircle, RefreshCw } from "lucide-react"

export default function VerifyEmailPage() {
  const { isLoaded, signUp, setActive } = useSignUp()
  const router = useRouter()

  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const [done, setDone] = useState(false)

  // If there is no pending verification, redirect to sign-up
  useEffect(() => {
    if (isLoaded && signUp?.status !== "missing_requirements") {
      // Already verified or no sign-up in progress — go to dashboard
      if (signUp?.status === "complete") {
        router.replace("/dashboard")
      }
    }
  }, [isLoaded, signUp, router])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isLoaded) return
    setError("")
    setLoading(true)

    try {
      const result = await signUp.attemptEmailAddressVerification({ code })

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId })
        setDone(true)
        setTimeout(() => router.push("/dashboard"), 1500)
      } else {
        setError("Verification failed. Please check your code and try again.")
      }
    } catch (err: any) {
      const msg = err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? "Invalid code. Please try again."
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (!isLoaded) return
    setResending(true)
    setError("")
    setResent(false)

    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" })
      setResent(true)
      setTimeout(() => setResent(false), 5000)
    } catch (err: any) {
      const msg = err?.errors?.[0]?.message ?? "Could not resend. Please try again."
      setError(msg)
    } finally {
      setResending(false)
    }
  }

  const email = signUp?.emailAddress ?? ""

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md shadow-xl border border-gray-100 rounded-2xl">
          <CardContent className="py-12 text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <p className="text-xl font-bold text-gray-800">Email verified!</p>
            <p className="text-sm text-gray-500">Taking you to your dashboard…</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md shadow-xl border border-gray-100 rounded-2xl">
        <CardHeader className="text-center pb-2">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#50B0E020" }}>
              <MailCheck className="h-6 w-6" style={{ color: "#50B0E0" }} />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold" style={{ color: "#1A1D24" }}>
            Verify your email
          </CardTitle>
          <CardDescription className="text-gray-500 mt-1">
            {email
              ? `We sent a 6-digit code to ${email}`
              : "Check your email for the verification code"}
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4">
          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <Label htmlFor="code">Verification code</Label>
              <Input
                id="code"
                required
                autoComplete="one-time-code"
                className="mt-1 rounded-xl tracking-widest text-center text-2xl font-mono h-14"
                placeholder="••••••"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
                {error}
              </div>
            )}

            {resent && (
              <div className="p-3 bg-green-50 border border-green-100 rounded-xl text-sm text-green-700">
                New code sent! Check your inbox.
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || code.length < 6}
              className="w-full text-white font-semibold rounded-xl"
              style={{ backgroundColor: "#50B0E0" }}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify email"}
            </Button>

            <div className="text-center">
              <button
                type="button"
                disabled={resending}
                className="inline-flex items-center gap-1 text-sm font-medium disabled:opacity-50"
                style={{ color: "#50B0E0" }}
                onClick={handleResend}
              >
                {resending ? (
                  <><Loader2 className="h-3 w-3 animate-spin" />Resending…</>
                ) : (
                  <><RefreshCw className="h-3 w-3" />Resend code</>
                )}
              </button>
            </div>

            <div className="text-center text-sm text-gray-500">
              Wrong account?{" "}
              <Link href="/auth/signup" className="font-medium" style={{ color: "#50B0E0" }}>
                Start over
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
