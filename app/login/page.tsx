import { Metadata } from 'next'
import { commonPageMetadata } from '@/lib/seo'
import LoginClient from './login-client'

export const metadata: Metadata = commonPageMetadata.login()

export default function LoginPage() {
  return (
    <div className="min-h-screen">
      <LoginClient />
    </div>
  )
}