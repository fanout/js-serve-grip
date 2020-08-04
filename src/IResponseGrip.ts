import { GripInstruct, PrefixedPublisher } from "@fanoutio/grip";

export default interface IResponseGrip {
    gripInstruct?: GripInstruct;
    getPublisher: () => PrefixedPublisher;
}