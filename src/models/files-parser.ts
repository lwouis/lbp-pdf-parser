import {Operation} from './operation'
import {PDFJS} from 'pdfjs-dist'
import {OperationsAndErrors} from './operations-and-errors'

export class FilesParser {

  static async parseFiles(files: File[], progressCallback: (progress: number) => void,
                          parsingMethod: (file: File) => Promise<Operation[]>): Promise<OperationsAndErrors> {
    progressCallback(0.1) // force progress to start updating the UI asap
    const result = new OperationsAndErrors([], [])
    await Promise.all(files.map(async file => {
      try {
        const fileOperations = await FilesParser.parseFile(file, parsingMethod)
        result.operations.push(...fileOperations)
      } catch (error) {
        console.error(error)
        result.errors.push(error)
      } finally {
        progressCallback(1 / files.length * 100)
      }
    }))
    result.operations.sort((a, b) => a.date.diff(b.date))
    return result
  }

  private static async parseFile(file: File, parsingMethod: (file: File) => Promise<Operation[]>): Promise<Operation[]> {
    try {
      return await parsingMethod(file)
    } catch (error) {
      console.error(error)
      throw new Error('Failed parsing file: \'' + file.name + '\'')
    }
  }
}
