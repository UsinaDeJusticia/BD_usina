"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Eye, EyeOff, Lock, CheckCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Check if user has a valid session for password recovery
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        // If no session, redirect to login
        router.push("/login")
      }
    }

    checkSession()
  }, [supabase, router])

  const validatePassword = (pwd: string) => {
    if (pwd.length < 8) {
      return "La contraseña debe tener al menos 8 caracteres"
    }
    if (!/(?=.*[a-z])/.test(pwd)) {
      return "La contraseña debe contener al menos una letra minúscula"
    }
    if (!/(?=.*[A-Z])/.test(pwd)) {
      return "La contraseña debe contener al menos una letra mayúscula"
    }
    if (!/(?=.*\d)/.test(pwd)) {
      return "La contraseña debe contener al menos un número"
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden")
      setIsLoading(false)
      return
    }

    // Validate password strength
    const passwordError = validatePassword(password)
    if (passwordError) {
      setError(passwordError)
      setIsLoading(false)
      return
    }

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      })

      if (updateError) {
        // No exponer el mensaje interno de Supabase; sí el caso más común.
        setError(
          /same|different|reused/i.test(updateError.message)
            ? "La nueva contraseña debe ser distinta de la anterior."
            : /weak|pwned|leaked|short|characters/i.test(updateError.message)
              ? "La contraseña no cumple la política de seguridad. Elegí una más robusta."
              : "No se pudo actualizar la contraseña. Solicitá un nuevo enlace e intentá otra vez.",
        )
        return
      }

      setSuccess(true)

      // Redirect to main app after 2 seconds
      setTimeout(() => {
        router.push("/")
      }, 2000)
    } catch (err) {
      console.error("Password update error:", err)
      setError("Error al actualizar la contraseña. Intente nuevamente.")
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
            <CardContent className="space-y-6 py-12 text-center">
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto" />
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-slate-800 font-montserrat">¡Contraseña Actualizada!</h1>
                <p className="text-slate-600">Su contraseña ha sido actualizada exitosamente.</p>
                <p className="text-sm text-slate-500">Redirigiendo a la aplicación...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
          <CardHeader className="space-y-6 pb-8 pt-8">
            {/* Logo */}
            <div className="flex justify-center">
              <div className="relative w-48 h-16">
                <Image
                  src="/images/logo-usina-justicia.png"
                  alt="Usina de Justicia"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            </div>

            {/* Title */}
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-slate-800 font-montserrat">Actualizar Contraseña</h1>
              <p className="text-slate-600 text-sm">Ingrese su nueva contraseña segura</p>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 pb-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* New Password Field */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-700 font-medium">
                  Nueva Contraseña
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 h-12 border-slate-200 focus:border-blue-600 focus:ring-blue-600"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password Field */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-slate-700 font-medium">
                  Confirmar Contraseña
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 pr-10 h-12 border-slate-200 focus:border-blue-600 focus:ring-blue-600"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Password Requirements */}
              <div className="text-xs text-slate-500 space-y-1">
                <p>La contraseña debe contener:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Al menos 8 caracteres</li>
                  <li>Una letra mayúscula y una minúscula</li>
                  <li>Al menos un número</li>
                </ul>
              </div>

              {/* Error Message */}
              {error && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertDescription className="text-red-700">{error}</AlertDescription>
                </Alert>
              )}

              {/* Update Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
              >
                {isLoading ? "Actualizando..." : "Actualizar Contraseña"}
              </Button>
            </form>

            {/* Security Notice */}
            <div className="text-center pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-500">Su nueva contraseña será requerida en futuros inicios de sesión</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
