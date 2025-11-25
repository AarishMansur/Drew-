export interface BaseData {
    userId:string
}

export interface Space extends BaseData{
    sharedLink:string,
    spaceId:string,
    participants:number
}

export interface AuthState extends BaseData {
    loggedIn:boolean;
}

export interface DrawingState extends BaseData {
    isDrawing:boolean,
    shape:string,
    textEnabled:boolean,
}

export type opeID = string


export interface operationBase extends BaseData{
    operationId:opeID,
    timestamp:number
}

export interface ShapeBase{
id:string,
x:number,
y:number,
}

export interface RectShape extends ShapeBase{
 type:"rect" | "square",
 width:number,
 height:number,
 fill:string,
 stroke:string,
}

export interface CircleShape extends ShapeBase{
    type:"circle",
    radius:number,
    fill:string,
    stroke:string,
}

export interface Textshape extends ShapeBase{
    type:"text",
    text:string,
    fontSize:number
}

export interface ArrowShape extends ShapeBase {
    type: "arrow";
    points: number[];
    fill: string;
    stroke: string;
  }

export type Shape = RectShape | CircleShape | Textshape | ArrowShape;

export interface CreateOperation extends operationBase{
    type:"create",
    payload:Shape,
}

export interface UpdateOperation extends operationBase{
    type:"update",
    payload:{
        id:string,
       before:Partial<Shape>
       after:Partial<Shape>
    }
}

export interface DeleteOperation extends operationBase{
    type:"delete",
    payload:{
        id:string
    }
}

export type Operation = CreateOperation | DeleteOperation | UpdateOperation

export interface SceneState{
shapes :Record<string,Shape>
seen:Record<opeID,boolean>
operations: Operation[];
    undoStack: Operation[];
    redoStack: Operation[];
}



 