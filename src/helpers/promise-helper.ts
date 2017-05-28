export class PromiseHelper {
  static async fileReaderAsArrayBufferP(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const fileReader = new FileReader()
      fileReader.onload = (event) => resolve(fileReader.result as ArrayBuffer)
      fileReader.onabort = (event) => reject(event)
      fileReader.onerror = (event) => reject(event)
      fileReader.readAsArrayBuffer(file)
    }) as Promise<ArrayBuffer>
  }

  static async fileReaderAsTextP(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const fileReader = new FileReader()
      fileReader.onload = (event) => resolve(fileReader.result as string)
      fileReader.onabort = (event) => reject(event)
      fileReader.onerror = (event) => reject(event)
      fileReader.readAsText(file)
    }) as Promise<string>
  }
}
