"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { saveColoringBook } from "@/lib/book-actions"
import { Slider } from "@/components/ui/slider"
import { CoverGenerator } from "@/components/book-builder/cover-generator"

// Import specific icons from lucide-react
import { Loader2, Save, Copy, MoveHorizontal, Trash2, ImageIcon, Type, Layout, Sparkles } from "lucide-react"

// Import DnD kit components
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

interface BookBuilderModalProps {
  isOpen: boolean
  onClose: () => void
  selectedImages: any[]
  onClearSelection: () => void
  userCredits: number
}

// Sortable item component
function SortableItem({ image, index }: { image: any; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: image.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative aspect-square rounded-md overflow-hidden border border-border hover:border-primary cursor-move group"
      {...attributes}
      {...listeners}
    >
      <img
        src={image.source === "gemini" ? image.coloring_page_url : image.image_url}
        alt={image.prompt || "Coloring page"}
        className="w-full h-full object-cover"
      />
      <div className="absolute top-2 left-2 bg-black/70 text-white text-xs font-medium px-2 py-1 rounded-full">
        Page {index + 1}
      </div>
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
        <MoveHorizontal className="text-white drop-shadow-md" />
      </div>
    </div>
  )
}

export function BookBuilderModal({
  isOpen,
  onClose,
  selectedImages,
  onClearSelection,
  userCredits,
}: BookBuilderModalProps) {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [bookTitle, setBookTitle] = useState("My Coloring Book")
  const [bookSubtitle, setBookSubtitle] = useState("A collection of coloring pages")
  const [coverImage, setCoverImage] = useState<string | null>(null)
  const [addBlankPages, setAddBlankPages] = useState(false)
  const [addPageNumbers, setAddPageNumbers] = useState(true)
  const [borderWidth, setBorderWidth] = useState(0)
  const [activeTab, setActiveTab] = useState("preview")
  const [orderedImages, setOrderedImages] = useState<any[]>([])
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [coverId, setCoverId] = useState<string | null>(null)

  // Set up DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  // Update ordered images when selected images change
  useEffect(() => {
    if (selectedImages && selectedImages.length > 0) {
      setOrderedImages([...selectedImages])
    }
  }, [selectedImages])

  // Handle drag end event
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setOrderedImages((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)

        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const handleRemoveImage = (imageId: string) => {
    setOrderedImages(orderedImages.filter((img) => img.id !== imageId))
  }

  

  const handleSaveBook = async () => {
    if (orderedImages.length === 0) {
      toast.error("Please select at least one image")
      return
    }

    // Check if user has enough credits
    if (userCredits < 20) {
      toast.error("Not enough credits", {
        description: "You need at least 20 credits to save a coloring book.",
      })
      return
    }

    setIsSaving(true)
    try {
      // Extract image IDs and maintain order
      const imageIds = orderedImages.map((img) => img.id)

      // Prepare book options
      const bookOptions = {
        addBlankPages,
        addPageNumbers,
        borderWidth,
      }

      // Save the book to the database with options and cover image
      const result = await saveColoringBook({
        title: bookTitle,
        subtitle: bookSubtitle,
        imageIds,
        coverId: coverId, // Pass the cover ID
        options: bookOptions,
      })

      if (!result.success) {
        throw new Error(result.error || "Failed to save book")
      }

      // Deduct 20 credits for book creation
      const response = await fetch("/api/deduct-credits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          credits: 20,
          description: "Coloring book creation",
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to deduct credits")
      }

      toast.success("Coloring book saved successfully!", {
        description: "20 credits have been deducted from your account.",
      })

      // Redirect to the books page
      router.push("/books")
      onClose()
    } catch (error: any) {
      console.error("Error saving book:", error)
      toast.error("Failed to save coloring book", {
        description: error.message || "Please try again.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleClose = () => {
    setShareUrl(null)
    onClose()
  }

  const onCoverGenerated = (url: string, id: string) => {
    setCoverImage(url)
    setCoverId(id)

    // If we're on the cover tab, we can optionally auto-advance to the next tab
    // Uncomment this if you want to auto-advance
    // if (activeTab === "cover") {
    //   setActiveTab("options");
    // }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Create Your Coloring Book</DialogTitle>
          <DialogDescription>
            Design, customize, and arrange your coloring book, then save it to your collection.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="preview" className="flex items-center">
              <Layout className="mr-2 h-4 w-4" />
              Arrange Pages
            </TabsTrigger>
            <TabsTrigger value="pro-cover" className="flex items-center">
              <Sparkles className="mr-2 h-4 w-4" />
              Cover
            </TabsTrigger>
            <TabsTrigger value="options" className="flex items-center">
              <Type className="mr-2 h-4 w-4" />
              Book Options
            </TabsTrigger>
          </TabsList>

          {/* Arrange Pages Tab */}
          <TabsContent value="preview" className="flex-1 overflow-auto p-4">
            <div className="mb-4">
              <p className="text-sm text-muted-foreground">
                Drag and drop to rearrange pages. Your coloring book will be created in this order.
              </p>
            </div>

            {orderedImages.length === 0 ? (
              <div className="flex items-center justify-center h-full p-12 border-2 border-dashed rounded-lg">
                <div className="text-center">
                  <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No images selected. Please select images from your gallery.</p>
                </div>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={orderedImages.map((img) => img.id)} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {orderedImages.map((image, index) => (
                      <div key={image.id} className="relative">
                        <SortableItem image={image} index={index} />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow-md"
                          onClick={() => handleRemoveImage(image.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                        
                      </div>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </TabsContent>

          {/* Professional Cover Tab */}
          <TabsContent value="pro-cover" className="flex-1 overflow-auto p-4" forceMount>
            <CoverGenerator onCoverGenerated={onCoverGenerated} userCredits={userCredits} />
          </TabsContent>

          {/* Book Options Tab */}
          <TabsContent value="options" className="flex-1 overflow-auto p-4">
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Page Options</h3>
                <p className="text-xs text-muted-foreground">
                  These settings will be applied when generating your coloring book.
                </p>

                <div className="space-y-2">
                  <Label>Border Width</Label>
                  <div className="flex items-center space-x-4">
                    <Slider
                      value={[borderWidth]}
                      min={0}
                      max={10}
                      step={1}
                      onValueChange={(value) => setBorderWidth(value[0])}
                      className="flex-1"
                    />
                    <span className="w-12 text-center">{borderWidth}mm</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Add a border around each coloring page.</p>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="blank-pages"
                    checked={addBlankPages}
                    onCheckedChange={(checked) => setAddBlankPages(checked as boolean)}
                  />
                  <Label htmlFor="blank-pages" className="font-normal cursor-pointer">
                    Add blank pages between coloring pages
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="page-numbers"
                    checked={addPageNumbers}
                    onCheckedChange={(checked) => setAddPageNumbers(checked as boolean)}
                  />
                  <Label htmlFor="page-numbers" className="font-normal cursor-pointer">
                    Add page numbers
                  </Label>
                </div>
              </div>

              <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                <h4 className="font-medium mb-2">Book Information</h4>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="book-title">Book Title</Label>
                    <Input
                      id="book-title"
                      value={bookTitle}
                      onChange={(e) => setBookTitle(e.target.value)}
                      placeholder="My Coloring Book"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="book-subtitle">Book Subtitle (Optional)</Label>
                    <Input
                      id="book-subtitle"
                      value={bookSubtitle}
                      onChange={(e) => setBookSubtitle(e.target.value)}
                      placeholder="A collection of coloring pages"
                    />
                  </div>
                </div>
              </div>

              {shareUrl && (
                <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                  <h4 className="font-medium mb-2">Share Your Coloring Book</h4>
                  <div className="flex items-center space-x-2">
                    <Input value={shareUrl} readOnly onClick={(e) => e.currentTarget.select()} />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(shareUrl)
                        toast.success("Link copied to clipboard!")
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Anyone with this link can view and download your coloring book.
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex-shrink-0 gap-2 sm:gap-0">
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={onClearSelection} className="flex-1 sm:flex-none">
              Clear Selection
            </Button>
            <Button
              onClick={handleSaveBook}
              disabled={isSaving || orderedImages.length === 0 || userCredits < 20}
              className="flex-1 sm:flex-none"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Book (20 Credits)
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}