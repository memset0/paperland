export interface PaperBoundServiceDef {
  name: string
  type: 'paper_bound'
  depends_on: string[]
  produces: string[]
  execute: (paperId: number, paper: any) => Promise<Partial<Record<string, any>>>
}

export interface PureServiceDef {
  name: string
  type: 'pure'
  execute: (...args: any[]) => Promise<any>
}

export type ServiceDef = PaperBoundServiceDef | PureServiceDef
