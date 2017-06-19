import {PDFJS} from 'pdfjs-dist'
import {OperationsAndErrors} from './operations-and-errors'
import {FilesParser} from './files-parser'
import {Operation} from './operation'
import {PromiseHelper} from '../helpers/promise-helper'
import {CsvWriter} from './csv-writer'
import {NumberHelper} from '../helpers/number-helper'
import * as moment from 'moment'

export class CsvParser {
  static async parseFiles(files: File[], progressCallback: (progress: number) => void): Promise<OperationsAndErrors> {
    return await FilesParser.parseFiles(files, progressCallback, CsvParser.operationsFromFile)
  }

  private static async operationsFromFile(file: File): Promise<Operation[]> {
    const fileContents = await PromiseHelper.fileReaderAsTextP(file)
    const operations = fileContents
      .split(CsvWriter.columnDelimiter + '\n')
      .filter(line => line.length > 0)
      .reduce((ops, line) => {
        const values = line.split(CsvWriter.columnSeparator)
        ops.push({
          date: moment(values[0], 'YYYY/MM/DD'),
          amount: NumberHelper.parseNumber(values[1], ','),
          description: values[2].substring(1),
        })
        return ops
      }, [])
    if (operations.length === 0) {
      throw new Error('CSV files contains no parsable operation.')
    }
    return operations
  }
}
