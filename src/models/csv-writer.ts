import * as FileSaver from 'file-saver'
import {Operation} from './operation'

export class CsvWritter {
  private static readonly columnSeparator = ','
  private static readonly columnDelimiter = '"'

  static async write(operations: Operation[]) {
    const blob = new Blob([CsvWritter.toCsvRows(operations)], {type: 'text/plain;charset=utf-8'})
    await FileSaver.saveAs(blob, 'operations.csv')
  }

  private static toCsvRows(operations: Operation[]): string {
    return operations.reduce((result, operation) => {
      return result + operation.date + CsvWritter.columnSeparator
        + operation.amount + CsvWritter.columnSeparator + CsvWritter.columnDelimiter
        + operation.description.replace('"', '\"') + CsvWritter.columnDelimiter + '\n'
    }, '')
  }
}
