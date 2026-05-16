"use client"

import { useState, Suspense } from "react"
import { useSignIn } from "@clerk/nextjs"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Lock, Loader2, Eye, EyeOff, CheckCircle } from "lucide-react"

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "8+ characters", ok: password.length >= 8 },
    { label: "Uppercase", ok: /[A-Z]/.test(password) },
    { label: "Lowercase", ok: /[a-z]/.test(password) },
    { label: "Number", ok: /\d/.test(password) },
  ]
  const score = checks.filter((c) => c.ok).length

  const color = score <= 1 ? "bg-red-400" : score === 2 ? "bg-orange-400" : score === 3 ? "bg-yellow-400" : "bg-green-500"

  return (
    <div className="space-y-2 mt-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= score ? color : "bg-gray-200"}`} />
        ))}
      </div>
      <div className="flex gap-3 flex-wrap">
        {checks.map((c) => (
          <span key={c.label} className={`text-xs ${c.ok ? "text-green-600" : "text-gray-400"}`}>
            {c.ok ? "✓" : "○"} {c.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function ResetPasswordContent() {
  const { isLoaded, signIn, setActive } = useSignIn()
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get("email") ?? ""

  const [code, setCode] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isLoaded) return
    if (password !== confirm) {
      setError("Passwords do not match.")
      return
    }
    setError("")
    setLoading(true)

    try {
      const result = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code,
        password,
      })

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId })
        setDone(true)
        setTimeout(() => router.push("/dashboard"), 2000)
      } else {
        setError("Verification incomplete. Please try again.")
      }
    } catch (err: any) {
      const msg = err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? "Invalid code or password. Please try again."
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="text-center space-y-4 py-4">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </div>
        <p className="font-semibold text-gray-800">Password updated!</p>
        <p className="text-sm text-gray-500">Signing you in…</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleReset} className="space-y-4">
      <div>
        <Label htmlFor="code">Reset code</Label>
        <Input
          id="code"
          required
          autoComplete="one-time-code"
          className="mt-1 rounded-xl tracking-widest text-center text-lg"
          placeholder="••••••"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        />
        <p className="text-xs text-gray-400 mt-1">
          {email ? `Sent to ${email}` : "Check your email for the 6-digit code"}
        </p>
      </div>

      <div>
        <Label htmlFor="password">New password</Label>
        <div className="relative mt-1">
          <Input
            id="password"
            type={showPass ? "text" : "password"}
            required
            autoComplete="new-password"
            className="rounded-xl pr-10"
            placeholder="Min 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            onClick={() => setShowPass(!showPass)}
          >
            {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {password && <PasswordStrength password={password} />}
      </div>

      <div>
        <Label htmlFor="confirm">Confirm new password</Label>
        <Input
          id="confirm"
          type="password"
          required
          autoComplete="new-password"
          className={`mt-1 rounded-xl ${confirm && confirm !== password ? "border-red-400" : ""}`}
          placeholder="Re-enter password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {confirm && confirm !== password && (
          <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      <Button
        type="submit"
        disabled={loading || !code || !password || password !== confirm}
        className="w-full text-white font-semibold rounded-xl"
        style={{ backgroundColor: "#50B0E0" }}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reset password"}
      </Button>

      <div className="text-center">
        <Link
          href="/auth/forgot-password"
          className="text-sm font-medium"
          style={{ color: "#50B0E0" }}
        >
          Didn't receive a code? Resend
        </Link>
      </div>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md shadow-xl border border-gray-100 rounded-2xl">
        <CardHeader className="text-center pb-2">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#50B0E020" }}>
              <Lock className="h-6 w-6" style={{ color: "#50B0E0" }} />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold" style={{ color: "#1A1D24" }}>
            Set a new password
          </CardTitle>
          <CardDescription className="text-gray-500 mt-1">
            Enter the code from your email and choose a new password
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>}>
            <ResetPasswordContent />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
