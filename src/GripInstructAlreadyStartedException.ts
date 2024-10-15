import { GripInstructException } from './GripInstructException.js';

export class GripInstructAlreadyStartedException extends GripInstructException {
    message = 'GripInstruct Already Started';
}
