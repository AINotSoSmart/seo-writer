import { jsPDF } from "jspdf"

type PaperSize = "letter" | "kdp_8_5x11" | "kdp_8x10" | "a4"

interface PDFOptions {
  title?: string
  subtitle?: string
  author?: string
  coverImage?: string | null
  addBlankPages?: boolean
  addPageNumbers?: boolean
  borderWidth?: number
  paperSize?: PaperSize
  bleedMm?: number
}

function getDimensions(paperSize: PaperSize = "letter", bleedMm: number = 0) {
  let width = 215.9
  let height = 279.4
  if (paperSize === "kdp_8x10") {
    width = 203.2
    height = 254
  } else if (paperSize === "kdp_8_5x11") {
    width = 215.9
    height = 279.4
  } else if (paperSize === "a4") {
    width = 210
    height = 297
  }
  return { width: width + bleedMm * 2, height: height + bleedMm * 2 }
}

export async function generatePDF(imageUrls: string[], options: PDFOptions = {}): Promise<Blob> {
  console.log("generatePDF called with options:", options)
  console.log("Number of images:", imageUrls.length)

  const { title, subtitle, author, coverImage, addBlankPages = false, addPageNumbers = true, borderWidth = 0, paperSize = "letter", bleedMm = 0 } = options

  // Log the cover image URL to debug
  console.log("Cover image URL passed to PDF generator:", coverImage)

  // Create a new PDF document
  console.log("Creating PDF document with selected size")
  const dims = getDimensions(paperSize, bleedMm)
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [dims.width, dims.height],
  })

  // Set page dimensions
  const pageWidth = dims.width
  const pageHeight = dims.height
  console.log("Page dimensions:", { width: pageWidth, height: pageHeight })

  // Set margins
  const margin = 10
  const contentWidth = pageWidth - margin * 2
  const contentHeight = pageHeight - margin * 2

  // Helper function to load an image
  const loadImage = (url: string, index: number): Promise<HTMLImageElement> => {
    console.log(`Loading image ${index} from URL:`, url)
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = "anonymous" // To avoid CORS issues
      img.onload = () => {
        console.log(`Image ${index} loaded successfully, dimensions:`, { width: img.width, height: img.height })
        resolve(img)
      }
      img.onerror = (e) => {
        console.error(`Error loading image ${index}:`, e)
        reject(new Error(`Failed to load image ${index}: ${url}`))
      }
      img.src = url
    })
  }

  // Add custom cover page
  if (coverImage) {
    console.log("Adding custom cover page with image URL:", coverImage)

    try {
      // Load the cover image
      console.log("Attempting to load cover image...")
      const img = await loadImage(coverImage, -1)
      console.log("Cover image loaded successfully")

      // Calculate dimensions to fit the entire page while maintaining aspect ratio
      const imgRatio = img.width / img.height
      const pageRatio = pageWidth / pageHeight

      let coverWidth, coverHeight, coverX, coverY

      if (imgRatio > pageRatio) {
        // Image is wider than page ratio - fit to width
        coverWidth = pageWidth
        coverHeight = pageWidth / imgRatio
        coverX = 0
        coverY = (pageHeight - coverHeight) / 2
      } else {
        // Image is taller than page ratio - fit to height
        coverHeight = pageHeight
        coverWidth = pageHeight * imgRatio
        coverX = (pageWidth - coverWidth) / 2
        coverY = 0
      }

      // Add the image to cover the entire page
      console.log("Adding cover image to PDF")
      doc.addImage(img, "JPEG", coverX, coverY, coverWidth, coverHeight)
      console.log("Cover image added successfully")
    } catch (error) {
      console.error("Error adding cover image:", error)
      // Continue without the image if it fails to load
    }
  } else {
    console.log("No cover image provided to PDF generator")
  }

  // Process each image - using single page layout only
  let currentPage = 0 // Start from page 0

  // Single page layout - one image per page
  for (let i = 0; i < imageUrls.length; i++) {
    console.log(`Processing image ${i}...`)

    // Add a new page for each image
    doc.addPage()
    currentPage++

    try {
      // Load the image
      const img = await loadImage(imageUrls[i], i)

      // Calculate dimensions to fit within margins while maintaining aspect ratio
      const imgRatio = img.width / img.height

      // Apply border if specified
      const effectiveMargin = margin + borderWidth
      const effectiveContentWidth = contentWidth - borderWidth * 2
      const effectiveContentHeight = contentHeight - borderWidth * 2

      let imgWidth = effectiveContentWidth
      let imgHeight = imgWidth / imgRatio

      if (imgHeight > effectiveContentHeight) {
        imgHeight = effectiveContentHeight
        imgWidth = imgHeight * imgRatio
      }

      console.log(`Image ${i} dimensions for PDF:`, { width: imgWidth, height: imgHeight, ratio: imgRatio })

      // Center the image on the page
      const imgX = margin + (contentWidth - imgWidth) / 2
      const imgY = margin + (contentHeight - imgHeight) / 2

      // Add border if specified
      if (borderWidth > 0) {
        doc.setDrawColor(0, 0, 0)
        doc.setLineWidth(0.5)
        doc.rect(margin, margin, contentWidth, contentHeight)
      }

      // Add the image to the PDF
      console.log(`Adding image ${i} to PDF at position:`, { x: imgX, y: imgY })
      doc.addImage(img, "JPEG", imgX, imgY, imgWidth, imgHeight)

      // Add page number if enabled
      if (addPageNumbers) {
        doc.setFont("helvetica", "normal")
        doc.setFontSize(10)
        doc.setTextColor(150, 150, 150)

        // Calculate page number
        const pageNum = currentPage
        console.log(`Adding page number ${pageNum} to image ${i}`)
        doc.text(`Page ${pageNum}`, pageWidth - margin - 15, pageHeight - margin - 5)
      }

      // Add a blank page after each coloring page if enabled
      if (addBlankPages && i < imageUrls.length - 1) {
        console.log(`Adding blank page after image ${i}`)
        doc.addPage()
        currentPage++

        // Add "Notes" text at the top of the blank page
        doc.setFont("helvetica", "italic")
        doc.setFontSize(12)
        doc.setTextColor(180, 180, 180)
        doc.text("Notes & Doodles", margin, margin + 10)

        // Add light grid lines for notes
        doc.setDrawColor(240, 240, 240)
        doc.setLineWidth(0.1)

        // Draw horizontal lines
        for (let y = margin + 20; y < pageHeight - margin; y += 10) {
          doc.line(margin, y, pageWidth - margin, y)
        }
      }
    } catch (error) {
      console.error(`Error processing image ${i}:`, error)
      // Continue with next image if one fails
    }
  }

  console.log("PDF generation completed successfully")

  // Return the PDF as a blob
  const pdfBlob = doc.output("blob")
  console.log("PDF blob created, size:", pdfBlob.size)
  return pdfBlob
}
