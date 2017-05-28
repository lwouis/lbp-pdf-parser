import {Moment} from 'moment/moment'

export interface Operation {
  date: Moment
  amount: number
  description: string
}
