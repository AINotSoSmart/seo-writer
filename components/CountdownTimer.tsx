'use client'

import { useEffect, useState } from 'react'

export function CountdownTimer() {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  })

  useEffect(() => {
    const calculateTimeLeft = () => {
      const christmas = new Date('December 25, 2024 23:59:00').getTime()
      const now = new Date().getTime()
      const difference = christmas - now

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60)
        })
      }
    }

    const timer = setInterval(calculateTimeLeft, 1000)
    calculateTimeLeft()

    return () => clearInterval(timer)
  }, [])

  return (
    <div className="grid grid-cols-4 gap-4 text-center my-4">
      {Object.entries(timeLeft).map(([key, value]) => (
        <div key={key} className="flex flex-col items-center">
          <div className="bg-indigo-700 text-white rounded-lg p-2 w-16 h-16 flex items-center justify-center">
            <span className="text-2xl font-bold">{value.toString().padStart(2, '0')}</span>
          </div>
          <span className="text-xs text-gray-600 mt-1 capitalize">{key}</span>
        </div>
      ))}
    </div>
  )
}

