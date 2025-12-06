"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import type React from "react"
import { useState } from "react"
import { Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FolioLogo } from "@/components/icons/FolioLogo"

interface NavbarProps {
  children: React.ReactNode
  className?: string
}

interface NavBodyProps {
  children: React.ReactNode
  className?: string
}

interface NavItemsProps {
  items: {
    name: string
    link: string
  }[]
  className?: string
  onItemClick?: () => void
}

interface MobileNavProps {
  children: React.ReactNode
  className?: string
}

interface MobileNavHeaderProps {
  children: React.ReactNode
  className?: string
}

interface MobileNavMenuProps {
  children: React.ReactNode
  className?: string
  isOpen: boolean
  onClose: () => void
}

export const Navbar = ({ children, className }: NavbarProps) => {
  return <motion.div className={cn("fixed inset-x-0 top-0 z-60 w-full pt-4 px-4", className)}>{children}</motion.div>
}

export const NavBody = ({ children, className }: NavBodyProps) => {
  return (
    <motion.div
      className={cn(
        "relative z-[60] mx-auto max-w-4xl flex-row items-center justify-between self-start rounded-lg bg-white/95 border border-gray-200 px-3 py-2 hidden backdrop-blur-lg lg:flex",
        className,
      )}
    >
      {children}
    </motion.div>
  )
}

export default Header
export { Header }

export const NavItems = ({ items, className, onItemClick }: NavItemsProps) => {
  const [hovered, setHovered] = useState<number | null>(null)
  return (
    <motion.div
      onMouseLeave={() => setHovered(null)}
      className={cn(
        "flex flex-1 flex-row items-center justify-center space-x-1 text-sm font-medium text-gray-600 transition duration-200",
        className,
      )}
    >
      {items.map((item, idx) => (
        <a
          onMouseEnter={() => setHovered(idx)}
          onClick={onItemClick}
          className="relative px-3 py-2 font-semibold transition-colors cursor-pointer"
          key={`link-${idx}`}
          href={item.link}
        >
          {hovered === idx && (
            <motion.div layoutId="hovered" className="absolute inset-0 h-full w-full rounded-md bg-gray-100" />
          )}
          <span className="relative z-20">{item.name}</span>
        </a>
      ))}
    </motion.div>
  )
}

export const MobileNav = ({ children, className }: MobileNavProps) => {
  return (
    <motion.div
      className={cn(
        "relative z-50 mx-auto flex w-[95%] max-w-[calc(100vw-1rem)] flex-col items-center justify-between bg-white/95 border border-gray-200 rounded-lg backdrop-blur-lg py-3 px-4 lg:hidden",
        className,
      )}
    >
      {children}
    </motion.div>
  )
}

export const MobileNavHeader = ({ children, className }: MobileNavHeaderProps) => {
  return <div className={cn("flex w-full flex-row items-center justify-between", className)}>{children}</div>
}

export const MobileNavMenu = ({ children, className, isOpen, onClose }: MobileNavMenuProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={cn(
            "absolute inset-x-0 top-16 z-50 flex w-full text-black font-semibold flex-col justify-start gap-2 rounded-lg bg-white border border-gray-200 px-4 py-6",
            className,
          )}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export const MobileNavToggle = ({
  isOpen,
  onClick,
}: {
  isOpen: boolean
  onClick: () => void
}) => {
  return (
    <Button onClick={onClick} className="text-sm py-1 group overflow-hidden bg-white hover:bg-gray-50">
      {isOpen ? <X className="h-8 w-8 text-black" /> : <Menu className="h-8 w-8 text-black" />}
    </Button>
  )
}

function Header() {
  const [isOpen, setIsOpen] = useState(false)

  const navItems = [
    { name: "Features", link: "/#features" },
    { name: "How it works", link: "/#how-it-works" },
    { name: "Shoot Packs", link: "/#style-packs" },
    { name: "Blog", link: "/blog" },
  ]

  return (
    <Navbar>
      <NavBody>
        {/* Logo */}
        <div className="flex items-center">
          <a href="/" className="flex items-center gap-2 cursor-pointer">
            <FolioLogo className="w-32 h-8" />
          </a>
        </div>

        {/* Navigation Items */}
        <NavItems items={navItems} />

        {/* CTA Button */}
        <div className="flex items-center gap-3">
          <Link href="/blog-writer">
            <Button
              className="text-sm py-5 group relative bg-[#ff6f00] text-white rounded-md overflow-hidden cursor-pointer pr-10"
            >
              Start Your Photoshoot
              <div className="bg-white rounded-sm p-[10px] absolute right-1 top-1/2 -translate-y-1/2">
              <img
                src="/arrow.svg"
                alt="arrow-right"
                className="w-3 h-3 transition-transform duration-200 group-hover:translate-x-1"
              />
              </div>
            </Button>
          </Link>
        </div>
      </NavBody>

      <MobileNav>
        <MobileNavHeader>
          <div className="flex items-center">
            <a href="/" className="flex items-center gap-2">
              <FolioLogo className="w-24 h-7" />
            </a>
          </div>
          <MobileNavToggle isOpen={isOpen} onClick={() => setIsOpen(!isOpen)} />
        </MobileNavHeader>

        <MobileNavMenu isOpen={isOpen} onClose={() => setIsOpen(false)}>
          <div className="flex flex-col items-center w-full">
            {navItems.map((item, idx) => (
              <a
                key={idx}
                href={item.link}
                className="w-full px-2 py-2 text-gray-600 hover:text-black transition-colors cursor-pointer text-center"
                onClick={() => setIsOpen(false)}
              >
                {item.name}
              </a>
            ))}
            <div className="flex flex-col gap-2 mt-4 w-full items-center">
              <Link href="/blog-writer">
                <Button
                  className="text-md py-6 group relative bg-[#ff6f00] text-white rounded-md overflow-hidden cursor-pointer pr-12"
                >
                  Start Your Photoshoot
                  <div className="bg-white rounded-sm p-3 absolute right-1 top-1/2 -translate-y-1/2">
                    <img
                      src="/arrow.svg"
                      alt="arrow-right"
                      className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1"
                    />
                  </div>
                </Button>
              </Link>
            </div>
          </div>
        </MobileNavMenu>
      </MobileNav>
    </Navbar>
  )
}