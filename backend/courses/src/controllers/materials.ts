import { Request, Response, NextFunction } from 'express';
import path from 'path';
import { catchAsync } from '@otmilms/common';
import { User, Material } from '../models/models';
import {
  AssignmentMaterialCreatedPublisher,
  CourseMaterialCreatedPublisher,
  CourseMaterialdeletedPublisher,
} from './events/publishers/course-publisher';
import { natsWrapper } from '../nats-wrapper';
// import APIFeatures from '../utils/apiFeatures';
// import fetch from 'node-fetch';
import { access, constants, mkdir } from 'fs';
import { MaterialDoc } from '../models/material';

///////////////// Course Materials /////////////////

export const createCourseMaterials = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const courseId = req.params.courseId;
    const creatorId = req.currentUser!.id;
    const user = await User.findById(creatorId);
    // TODO: use fs.mkdir to create a directory of "courseName/assignmentName" instead of "courseName-assignmentName"

    // 4) create an array to keep account of the saved materialFiles
    let materialFiles: MaterialDoc[] = [];

    // 5) iterate through the files and build a db model for each
    const { names, lastUpdates, fileTypes } = req.body;

    if (req.files) {
      for (let i = 0; i < req.files.length; i++) {
        const name = names[i];
        const filePath = `api/courses/public/course-materials/${req.files[i].filename}`;
        const fileType = fileTypes[i];

        const createdStudentDeliveryFile = Material.build({
          name,
          filePath,
          fileType,
          courseId,
          creatorId,
        });

        const updatedMaterialFile = await createdStudentDeliveryFile.save();

        materialFiles.push(updatedMaterialFile);

        // 6)  publish the event
        await new CourseMaterialCreatedPublisher(natsWrapper.client).publish({
          id: updatedMaterialFile.id,
          name: updatedMaterialFile.name,
          lastUpdate: updatedMaterialFile.lastUpdate as Date,
          courseId: updatedMaterialFile.courseId,
          creatorId: updatedMaterialFile.creatorId as string,
          user: `${user!.firstName} ${user!.lastName}`,
          email: user!.email,
          filePath: updatedMaterialFile.filePath,
          fileType: updatedMaterialFile.fileType,
          time: new Date(),
        });
      }
    }

    const fetchedMaterialFiles = await Material.find({
      courseId,
    });

    // 7) seng the response
    res.status(201).json({
      message: 'studentDeliveriesFiles added successfuly',
      materialFiles,
      fetchedMaterialFiles,
    });
  }
);

export const getCourseMaterials = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const courseId = req.params.courseId;
    const pageSize = +req.query.pagesize!;
    const currentPage = +req.query.page!;
    // get the materials of a specific assignment and a specific course
    let materialsQuery = Material.find({
      courseId: courseId,
    });

    let sortObj;
    if (`${req.query.sort}` !== '') {
      sortObj = JSON.parse(`${req.query.sort}`);

      if (sortObj.direction === 'asc') {
        materialsQuery = materialsQuery.sort([[sortObj.active, 1]]);
      } else if (sortObj.direction === 'desc') {
        materialsQuery = materialsQuery.sort([[sortObj.active, -1]]);
      }
    } else {
      materialsQuery = materialsQuery.sort([['name', 1]]);
    }

    let fetchedMaterials = await materialsQuery
      .skip(pageSize * (currentPage - 1))
      .limit(pageSize);

    const count = await Material.find({
      courseId: courseId,
    }).countDocuments();

    res.status(200).json({
      message: 'Materials fetched successfully!',
      fetchedMaterials,
      maxMaterials: count,
    });
  }
);

export const deleteCourseMaterials = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const materialId = req.params.materialId;
    const userId = req.currentUser!.id;
    const user = await User.findById(userId);
    const material = await Material.findById(materialId).populate('creatorId');
    const creatorId = material!.creatorId;

    let result;

    const materialToBeDeleted = await Material.findById(materialId);

    if (
      user!.role === 'admin' ||
      (user!.role === 'instructor' && user!.id === creatorId)
    ) {
      result = await Material.deleteOne({ _id: materialId });

      // 6)  publish the event
      if (materialToBeDeleted) {
        await new CourseMaterialdeletedPublisher(natsWrapper.client).publish({
          id: materialToBeDeleted.id,
          name: materialToBeDeleted.name,
          lastUpdate: materialToBeDeleted.lastUpdate as Date,
          courseId: materialToBeDeleted.courseId,
          creatorId: materialToBeDeleted.creatorId as string,
          user: `${user!.firstName} ${user!.lastName}`,
          email: user!.email,
          filePath: materialToBeDeleted.filePath,
          fileType: materialToBeDeleted.fileType,
          time: new Date(),
        });
      }
    }

    if (result.n! > 0) {
      res.status(200).json({ message: 'Delete successfull' });
    } else {
      res.status(401).json({ message: 'Not authorized' });
    }
  }
);

export const downloadCourseMaterials = (req: Request, res: Response) => {
  // const file = path.resolve(req.body.filePath);
  const file = path.join(
    __dirname,
    '..',
    `/public/course-materials/${req.body.filePath}`
  );

  res.download(file);
};

///////////////// Assignment Materials /////////////////

export const createAssignmentMaterials = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const courseId = req.params.courseId;
    const assignmentId = req.params.assignmentId;
    const creatorId = req.currentUser!.id;
    const user = await User.findById(creatorId);
    // TODO: use fs.mkdir to create a directory of "courseName/assignmentName" instead of "courseName-assignmentName"

    // 4) create an array to keep account of the saved materialFiles
    let materialFiles: MaterialDoc[] = [];

    // 5) iterate through the files and build a db model for each
    const { names, fileTypes } = req.body;
    if (req.files) {
      for (let i = 0; i < req.files.length; i++) {
        const name = names[i];
        const filePath = `api/courses/public/assignment-materials/${req.files[i].filename}`;
        const fileType = fileTypes[i];

        const createdStudentDeliveryFile = Material.build({
          name,
          filePath,
          fileType,
          courseId,
          assignmentId,
          creatorId,
        });

        const updatedStudentDeliveryFile =
          await createdStudentDeliveryFile.save();

        materialFiles.push(updatedStudentDeliveryFile);

        // 6)  publish the event
        await new AssignmentMaterialCreatedPublisher(
          natsWrapper.client
        ).publish({
          id: updatedStudentDeliveryFile.id,
          name: updatedStudentDeliveryFile.name,
          lastUpdate: updatedStudentDeliveryFile.lastUpdate as Date,
          courseId: updatedStudentDeliveryFile.courseId,
          creatorId: updatedStudentDeliveryFile.creatorId as string,
          assignmentId: updatedStudentDeliveryFile.assignmentId as string,
          user: `${user!.firstName} ${user!.lastName}`,
          email: user!.email,
          filePath: updatedStudentDeliveryFile.filePath,
          fileType: updatedStudentDeliveryFile.fileType,
          time: new Date(),
        });
      }
    }

    const fetchedMaterialFiles = await Material.find({
      courseId,
      assignmentId,
    });

    // 7) seng the response
    res.status(201).json({
      message: 'studentDeliveriesFiles added successfuly',
      materialFiles,
      fetchedMaterialFiles,
    });
  }
);

export const getAssignmentMaterials = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const courseId = req.params.courseId;
    const assignmentId = req.params.assignmentId;
    const pageSize = +req.query.pagesize!;
    const currentPage = +req.query.page!;
    // get the materials of a specific assignment and a specific course
    let materialsQuery = Material.find({
      courseId: courseId,
    });

    let sortObj;
    if (`${req.query.sort}` !== '') {
      sortObj = JSON.parse(`${req.query.sort}`);

      if (sortObj.direction === 'asc') {
        materialsQuery = materialsQuery.sort([[sortObj.active, 1]]);
      } else if (sortObj.direction === 'desc') {
        materialsQuery = materialsQuery.sort([[sortObj.active, -1]]);
      }
    } else {
      materialsQuery = materialsQuery.sort([['name', 1]]);
    }

    let fetchedMaterials = await materialsQuery
      .skip(pageSize * (currentPage - 1))
      .limit(pageSize);

    const count = await Material.find({
      courseId: courseId,
    }).countDocuments();

    res.status(200).json({
      message: 'Materials fetched successfully!',
      fetchedMaterials,
      maxMaterials: count,
    });
  }
);

export const deleteAssignmentMaterials = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const materialId = req.params.materialId;
    const material = await Material.findById(materialId).populate('creatorId');
    const userId = req.currentUser!.id;
    const user = await User.findById(userId);
    const creatorId = material!.creatorId;

    const materialToBeDeleted = await Material.findById(materialId);

    let result;
    if (
      user!.role === 'admin' ||
      (user!.role === 'instructor' && user!.id === creatorId)
    ) {
      result = await Material.deleteOne({ _id: materialId });

      // 6)  publish the event
      if (materialToBeDeleted) {
        await new AssignmentMaterialCreatedPublisher(
          natsWrapper.client
        ).publish({
          id: materialToBeDeleted.id,
          name: materialToBeDeleted.name,
          lastUpdate: materialToBeDeleted.lastUpdate as Date,
          courseId: materialToBeDeleted.courseId,
          creatorId: materialToBeDeleted.creatorId as string,
          assignmentId: materialToBeDeleted.assignmentId as string,
          user: `${user!.firstName} ${user!.lastName}`,
          email: user!.email,
          filePath: materialToBeDeleted.filePath,
          fileType: materialToBeDeleted.fileType,
          time: new Date(),
        });
      }
    }

    if (result.n! > 0) {
      res.status(200).json({ message: 'Delete successfull' });
    } else {
      res.status(401).json({ message: 'Not authorized' });
    }
  }
);

export const downloadAssignmentMaterials = (req: Request, res: Response) => {
  // const file = path.resolve(req.body.filePath);
  const file = path.join(
    __dirname,
    '..',
    `/public/assignment-materials/${req.body.filePath}`
  );

  res.download(file);
};

///////////////// Rest //////////////////

// return a blob file for reading pdf file
export const getBlobFile = catchAsync(async (req: Request, res: Response) => {
  const url = path.join(
    __dirname,
    '..',
    `/public/materials/${req.body.filePath}`
  );

  // // console.log(req.body.filePath);
  // // console.log(process.env.BARE_URL);

  // const baseURL = process.env.BARE_URL;

  // const newUrl = new URL(req.body.filePath, baseURL);
  // // console.log(newUrl);

  // const stats = fs.statSync(url2);
  // // console.log(stats);
  // const fileSizeInBytes = stats.size;
  // // console.log(fileSizeInBytes);
  // let readStream = fs.createReadStream(url2);
  // // console.log(readStream);

  // const response = await fetch(newUrl);

  // // console.log(response);
  // const blob = response.blob();
  // // console.log(blob);
  // // then((res) => {
  // //   console.log(res);
  // //   blob = res.blob();
  // //   console.log(blob);
  // // });

  res.status(200).sendFile(url);
});

const toHumanDateTime = (date: Date) => {
  let month = (date.getMonth() + 1).toString();

  let newDateArray = date.toDateString().split(' ');
  // delete the day name
  newDateArray.splice(0, 1);
  // change the month name to month numbers
  newDateArray.splice(0, 1, month);
  // monve the month to the center
  monveInArray(newDateArray, 0, 1);
  let newDate = newDateArray.join(' ').replace(/\ /g, '/');
  let newTime = date.toTimeString().split(' ')[0];

  return `${newDate} ${newTime}`;
};

const monveInArray = (arr: string[], from: number, to: number): void => {
  let item = arr.splice(from, 1);

  arr.splice(to, 0, item[0]);
};
