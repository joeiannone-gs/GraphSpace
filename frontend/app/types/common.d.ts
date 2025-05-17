export type Pos = [number, number]

export type Size = [number, number] //height, width (in pixels)

export type Id = string

type Tensor = number | string | Tensor[]

export type ArrayRange = [number, number, number]
export type Slice = ArrayRange[] //[Start, Stop, Stride]
