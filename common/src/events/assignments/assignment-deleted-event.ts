import { Subjects } from './../base/subjects';

export interface AssignmentDeletedEvent {
  subject: Subjects.AssignmentDeleted;
  data: {
    id: string;
    title: string;
    description: string;
    lastUpdate: Date;
    user: string;
    email: string;
    time: Date;
  };
}
