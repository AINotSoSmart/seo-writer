'use client'

import { useState, useEffect } from 'react'

export function usePhotoCoach() {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    // Check if user has completed onboarding
    const completed = localStorage.getItem('photoCoachCompleted')
    setHasCompletedOnboarding(completed === 'true')
  }, [])

  const openPhotoCoach = () => {
    if (!hasCompletedOnboarding) {
      setIsModalOpen(true)
    }
  }

  const closePhotoCoach = () => {
    setIsModalOpen(false)
  }

  const completePhotoCoach = () => {
    localStorage.setItem('photoCoachCompleted', 'true')
    setHasCompletedOnboarding(true)
    setIsModalOpen(false)
  }

  const resetPhotoCoach = () => {
    localStorage.removeItem('photoCoachCompleted')
    setHasCompletedOnboarding(false)
  }

  return {
    hasCompletedOnboarding,
    isModalOpen,
    openPhotoCoach,
    closePhotoCoach,
    completePhotoCoach,
    resetPhotoCoach
  }
}