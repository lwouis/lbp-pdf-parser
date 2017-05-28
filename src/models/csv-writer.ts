import * as FileSaver from 'file-saver'
import {Operation} from './operation'

export class CsvWriter {
  public static readonly columnSeparator = ','
  public static readonly columnDelimiter = '"'

  static async write(operations: Operation[]) {
    const blob = new Blob([CsvWriter.toCsvRows(operations)], {type: 'text/plain;charset=utf-8'})
    await FileSaver.saveAs(blob, 'operations.csv')
  }

  private static toCsvRows(operations: Operation[]): string {
    return operations.reduce((result, operation) => {
      return result + operation.date.format('YYYY/MM/DD') + CsvWriter.columnSeparator
        + operation.amount + CsvWriter.columnSeparator + CsvWriter.columnDelimiter
        + operation.description.replace('"', '\"') + CsvWriter.columnDelimiter + '\n'
    }, '')
  }
}
