import fs from 'fs'
import path from 'path'

export async function getAllToolSlugs(): Promise<string[]> {
    const toolsDirectory = path.join(process.cwd(), 'app/tools')

    try {
        const entries = await fs.promises.readdir(toolsDirectory, { withFileTypes: true })

        return entries
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name)
            // Filter out any directories that shouldn't be treated as tools (e.g., internal components if any)
            // For now, we assume all directories in app/tools are tools
            .filter((name) => !name.startsWith('(') && !name.startsWith('_'))
    } catch (error) {
        console.error('Error reading tools directory:', error)
        return []
    }
}
