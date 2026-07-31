"use client"

import * as React from "react"
import { X, Globe, Tag } from "lucide-react"
import { cn } from "@/lib/utils"

export interface PillInputProps {
    value: string[]
    onChange: (value: string[]) => void
    placeholder?: string
    className?: string
    variant?: "default" | "url" | "keyword"
    /** When true, existing pills can be removed but nothing new can be added. */
    disableAdd?: boolean
}

export function PillInput({
    value = [],
    onChange,
    placeholder,
    className,
    variant = "default",
    disableAdd = false,
}: PillInputProps) {
    const [inputValue, setInputValue] = React.useState("")
    const inputRef = React.useRef<HTMLInputElement>(null)

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault()
            addPill()
        } else if (e.key === "Backspace" && inputValue === "" && value.length > 0) {
            const newValue = [...value]
            newValue.pop()
            onChange(newValue)
        }
    }

    const addPill = () => {
        if (disableAdd) return
        const trimmed = inputValue.trim()
        if (trimmed) {
            if (!value.includes(trimmed)) {
                onChange([...value, trimmed])
            }
            setInputValue("")
        }
    }

    const removePill = (index: number) => {
        const newValue = [...value]
        newValue.splice(index, 1)
        onChange(newValue)
    }

    const handleContainerClick = () => {
        if (!disableAdd) inputRef.current?.focus()
    }

    const renderIcon = () => {
        if (variant === "url") return <Globe className="w-3 h-3 text-stone-500 shrink-0" />
        if (variant === "keyword") return <Tag className="w-3 h-3 text-stone-500 shrink-0" />
        return null
    }

    return (
        <div
            className={cn(
                "flex flex-wrap items-center gap-1.5 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm transition-all",
                "focus-within:ring-1 focus-within:ring-stone-200 focus-within:border-stone-200",
                "min-h-[42px]",
                disableAdd && "cursor-default",
                className
            )}
            onClick={handleContainerClick}
        >
            {value.map((item, index) => (
                <div
                    key={index}
                    className="group flex items-center gap-1.5 bg-stone-100 text-stone-700 pl-2 pr-1 py-0.5 rounded text-xs font-medium border border-transparent hover:border-stone-200 transition-all select-none"
                >
                    {renderIcon()}
                    <span className="max-w-[200px] truncate">{item}</span>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation()
                            removePill(index)
                        }}
                        className="text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded p-0.5 focus:outline-none transition-colors ml-0.5"
                    >
                        <X className="h-3 w-3" />
                        <span className="sr-only">Remove {item}</span>
                    </button>
                </div>
            ))}

            {!disableAdd && (
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={addPill}
                    className="flex-1 bg-transparent border-none outline-none min-w-[120px] placeholder:text-stone-400 text-stone-900 text-sm h-6 py-0 focus:ring-0"
                    placeholder={value.length === 0 ? placeholder : ""}
                />
            )}
        </div>
    )
}
