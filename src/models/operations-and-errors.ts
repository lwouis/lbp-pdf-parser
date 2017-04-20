import {Operation} from './operation'

export class OperationsAndErrors {
  constructor(public operations: Operation[], public errors: Error[]) {
  }
}
