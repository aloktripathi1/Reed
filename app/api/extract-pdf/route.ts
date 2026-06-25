import { NextResponse } from 'next/server'

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json({ error: 'Expected multipart/form-data.' }, { status: 400 })
    }

    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        {
          error: `File too large — maximum is 5 MB (got ${(file.size / 1024 / 1024).toFixed(1)} MB).`,
        },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    let text: string
    let parser: { getText: () => Promise<{ text?: string }>; destroy: () => Promise<void> } | undefined
    try {
      const { PDFParse } = await import('pdf-parse')
      parser = new PDFParse({ data: buffer })
      const result = await parser.getText()
      text = result.text ?? ''
    } catch {
      return NextResponse.json(
        {
          error:
            "Couldn't read text from this PDF, it may be a scanned image. Try pasting the text directly.",
        },
        { status: 422 }
      )
    } finally {
      await parser?.destroy().catch(() => undefined)
    }

    // Fewer than 40 non-whitespace characters means the PDF is effectively image-only.
    if (text.replace(/\s/g, '').length < 40) {
      return NextResponse.json(
        {
          error:
            "Couldn't read text from this PDF, it may be a scanned image. Try pasting the text directly.",
        },
        { status: 422 }
      )
    }

    return NextResponse.json({ text: text.trim() })
  } catch {
    return NextResponse.json(
      { error: 'Could not process that PDF. Try a smaller text-based PDF or paste the text directly.' },
      { status: 500 }
    )
  }
}
