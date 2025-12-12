"use client"

import React, { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { GripVertical, Plus, Trash2, AlignLeft, Type } from "lucide-react"

interface Section {
  id: number
  heading: string
  level?: number
  instruction_note: string
  keywords_to_include: string[]
}

interface OutlineData {
  title: string
  intro: {
    instruction_note: string
    keywords_to_include: string[]
  }
  sections: Section[]
}

interface OutlineEditorProps {
  initialData: OutlineData | null
  onChange: (data: OutlineData) => void
}

export default function OutlineEditor({ initialData, onChange }: OutlineEditorProps) {
  const [data, setData] = useState<OutlineData>({
    title: "",
    intro: {
      instruction_note: "",
      keywords_to_include: []
    },
    sections: []
  })

  useEffect(() => {
    if (initialData) {
      const completeData = {
        ...initialData,
        intro: initialData.intro || { instruction_note: "", keywords_to_include: [] }
      }
      setData(completeData)
    }
  }, [initialData])

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newData = { ...data, title: e.target.value }
    setData(newData)
    onChange(newData)
  }

  const handleIntroChange = (field: "instruction_note" | "keywords_to_include", value: any) => {
    const newIntro = { ...data.intro, [field]: value }
    const newData = { ...data, intro: newIntro }
    setData(newData)
    onChange(newData)
  }

  const handleIntroKeywordsChange = (value: string) => {
    const keywords = value.split(",").map(k => k.trim()).filter(k => k)
    handleIntroChange("keywords_to_include", keywords)
  }

  const handleSectionChange = (index: number, field: keyof Section, value: any) => {
    const newSections = [...data.sections]
    newSections[index] = { ...newSections[index], [field]: value }
    const newData = { ...data, sections: newSections }
    setData(newData)
    onChange(newData)
  }

  const handleKeywordsChange = (index: number, value: string) => {
    const keywords = value.split(",").map(k => k.trim()).filter(k => k)
    handleSectionChange(index, "keywords_to_include", keywords)
  }

  const addSection = () => {
    const newSection: Section = {
      id: (data.sections.length > 0 ? Math.max(...data.sections.map(s => s.id)) : 0) + 1,
      heading: "New Section",
      level: 2,
      instruction_note: "",
      keywords_to_include: []
    }
    const newData = { ...data, sections: [...data.sections, newSection] }
    setData(newData)
    onChange(newData)
  }

  const removeSection = (index: number) => {
    const newSections = data.sections.filter((_, i) => i !== index)
    const newData = { ...data, sections: newSections }
    setData(newData)
    onChange(newData)
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Title Section */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Article Title</span>
        </div>
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-gray-50 text-gray-400 border border-gray-100 shrink-0">
            <Type className="w-5 h-5" />
          </div>
          <Input
            value={data.title}
            onChange={handleTitleChange}
            className="flex-1 text-lg font-medium border-gray-200 focus-visible:ring-1 focus-visible:ring-gray-950 h-10"
            placeholder="Enter article title..."
          />
        </div>
      </div>

      <div className="h-px bg-gray-100" />

      {/* Intro Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Introduction</span>
        </div>

        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50/50 px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <AlignLeft className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Intro Hook & Context</span>
          </div>
          <div className="p-4 space-y-4 bg-white">
            <div className="space-y-1.5">
              <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Instructions</label>
              <Textarea
                value={data.intro.instruction_note}
                onChange={(e) => handleIntroChange("instruction_note", e.target.value)}
                className="min-h-[80px] bg-white border-gray-200 resize-none text-sm"
                placeholder="What should the intro cover?"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Keywords</label>
              <Input
                value={data.intro.keywords_to_include.join(", ")}
                onChange={(e) => handleIntroKeywordsChange(e.target.value)}
                className="bg-white border-gray-200 h-9 text-sm"
                placeholder="Keywords to include..."
              />
            </div>
          </div>
        </div>
      </div>

      <div className="h-px bg-gray-100" />

      {/* Sections List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Body Sections</span>
          <span className="text-xs text-gray-400">{data.sections.length} sections</span>
        </div>

        <div className="space-y-3">
          {data.sections.map((section, index) => {
            const level = section.level || 2
            return (
              <div
                key={section.id}
                className="group relative"
                style={{ paddingLeft: `${(level - 2) * 1.5}rem` }}
              >
                {/* Connector Line for nested items */}
                {level > 2 && (
                  <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-100 ml-[0.75rem]" />
                )}

                <div className="bg-white border border-gray-200 rounded-lg transition-all hover:border-gray-300">
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value={`item-${section.id}`} className="border-none">
                      <div className="flex items-center gap-3 p-3">
                        <GripVertical className="w-4 h-4 text-gray-300 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity" />

                        <Select
                          value={String(level)}
                          onValueChange={(v) => handleSectionChange(index, "level", parseInt(v))}
                        >
                          <SelectTrigger className="h-7 w-[3.5rem] px-1.5 bg-gray-50 text-gray-600 border-gray-200 text-xs font-medium focus:ring-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="2">H2</SelectItem>
                            <SelectItem value="3">H3</SelectItem>
                            <SelectItem value="4">H4</SelectItem>
                          </SelectContent>
                        </Select>

                        <Input
                          value={section.heading}
                          onChange={(e) => handleSectionChange(index, "heading", e.target.value)}
                          className="flex-1 font-medium border-transparent hover:border-gray-200 focus-visible:ring-0 focus-visible:border-gray-300 h-8 px-2 text-sm shadow-none bg-transparent"
                          placeholder="Section Heading"
                        />

                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-gray-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                            onClick={() => removeSection(index)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                          <AccordionTrigger className="p-0 hover:no-underline w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-400" />
                        </div>
                      </div>

                      <AccordionContent className="px-3 pb-3 pt-0">
                        <div className="pl-10 space-y-3">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Instructions</label>
                            <Textarea
                              value={section.instruction_note}
                              onChange={(e) => handleSectionChange(index, "instruction_note", e.target.value)}
                              className="min-h-[80px] bg-gray-50/30 border-gray-200 resize-none text-sm focus-visible:bg-white transition-colors"
                              placeholder="What should this section cover?"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Keywords</label>
                            <Input
                              value={section.keywords_to_include.join(", ")}
                              onChange={(e) => handleKeywordsChange(index, e.target.value)}
                              className="bg-gray-50/30 border-gray-200 h-8 text-sm focus-visible:bg-white transition-colors"
                              placeholder="Keywords..."
                            />
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <Button
        variant="outline"
        className="w-full py-6 border-dashed border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50 hover:border-gray-300 transition-all"
        onClick={addSection}
      >
        <Plus className="w-4 h-4 mr-2" /> Add Section
      </Button>
    </div>
  )
}
