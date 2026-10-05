export interface PaperBoundServiceDef {
  name: string
  type: 'paper_bound'
  depends_on: string[]
  produces: string[]
  /**
   * When true, this service only runs for papers with `listed=1`. For metadata-only
   * (`listed=0`) papers it is deferred until the paper is promoted to the library.
   */
  requires_listed?: boolean
  execute: (paperId: number, paper: any) => Promise<Partial<Record<string, any>>>
}

export interface PureServiceDef {
  name: string
  type: 'pure'
  execute: (...args: any[]) => Promise<any>
}

export type ServiceDef = PaperBoundServiceDef | PureServiceDef
