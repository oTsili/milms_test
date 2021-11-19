import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { Router } from '@angular/router';
import { Sort } from '@angular/material/sort';
import { FormArray, FormBuilder, FormControl } from '@angular/forms';

import { environment } from 'src/environments/environment';
import { Material } from 'src/app/models/material.model';
import { Assignment } from 'src/app/models/assignment.model';
import { Course } from 'src/app/models/course.model';
import { SharedService } from 'src/app/shared/services/shared.service';

const BACKEND_URL = environment.ASSIGNMENT_BASE_URL + '/api/courses';

@Injectable({ providedIn: 'root' })
export class AssignmentMaterialsService {
  private materials: Material[] = [];

  private materialsListener = new Subject<Material[]>();
  private materialsUpdated = new Subject<{
    materials: Material[];
    materialCount: number;
  }>();

  constructor(private http: HttpClient, private sharedService: SharedService) {}

  getAssignmentMaterialListener() {
    return this.materialsListener.asObservable();
  }

  onAssignmentMaterialsUpdate(materials) {
    console.log('materials updated');
    this.materialsListener.next(materials);
  }

  getAssignmentMaterials(
    coursesPerPage: number,
    currentPage: number,
    courseId: string,
    assignmentId: string,
    sort: string | Sort = ''
  ) {
    const queryParams = `?pagesize=${coursesPerPage}&page=${currentPage}&sort=${sort}`;
    return this.http
      .get<{ message: string; fetchedMaterials: any; maxMaterials: number }>(
        `${BACKEND_URL}/${courseId}/assignments/${assignmentId}/materials${queryParams}`,
        {
          withCredentials: true,
        }
      )
      .pipe(
        map((materialData) => {

          if (materialData.fetchedMaterials) {
            return {
              materials: materialData.fetchedMaterials.map(
                (material, index) => {
                  return {
                    position: (currentPage - 1) * coursesPerPage + (index + 1),
                    name: material.name,
                    filePath: material.filePath,
                    fileType: material.fileType,
                    lastUpdate:
                      this.sharedService.toHumanDateTime(material.lastUpdate),
                    assignmentId: material.assignmentId,
                    courseId: material.courseId,
                    id: material.id,
                  };
                }
              ),
              maxMaterials: materialData.maxMaterials,
            };
          }
          // if there are no any materials yet in the assigment
          return null;
        })
      );
  }

  addAssignmentMaterials(
    courseId: string,
    assignmentId: string,
    materialsControl: FormArray
  ) {

    const materialsData = new FormData();

    materialsData.append('courseId', courseId as string);
    materialsData.append('assignmentId', assignmentId as string);
    // materialsData.append('assignmentId', id);
    // materialsData.append('lastUpdate', lastUpdate);

    // overpass the previously saved files in the db begining from the index of their number
    for (let i = 0; i < materialsControl.length; i++) {
      let materialFile = materialsControl.value[i];



      if (!materialFile.creatorId) {

        materialsData.append('names[]', (materialFile as Material).name);
        materialsData.append(
          'fileTypes[]',
          (materialFile as Material).fileType
        );
        materialsData.append(
          'filePaths[]',
          (materialFile as Material).filePath,
          materialFile.name.split('.')[0]
        );
      }
    }


    // const params = new HttpParams();

    const options = {
      // params,
      // reportProgress: true,
      withCredentials: true,
    };

    return (
      this.http
        // generic type definition, to define what is going to be returned from the http request
        .post<{
          message: string;
          fetchedMaterialFiles: Material[];
        }>(
          `${BACKEND_URL}/${courseId}/assignments/${assignmentId}/materials`,
          materialsData,
          options
        )
        .pipe(
          map((materialsFileData) => {

            return {
              fetchedMaterialFiles: materialsFileData.fetchedMaterialFiles.map(
                (materialFile) => {
                  return {
                    id: materialFile.id,
                    name: materialFile.name,
                    filePath: materialFile.filePath,
                    fileType: materialFile.fileType,
                    assignmentId: materialFile.assignmentId,
                  };
                }
              ),
            };
          })
        )
    );
  }

  updateAssignmentMaterial(currentMaterial: Material) {
    const { id, name, filePath, fileType, lastUpdate, assignmentId, courseId } =
      currentMaterial;

    let materialData: Material | FormData;
    // only the file has type object- if updating only the text inputs, the type will be string
    if (typeof filePath === 'object') {
      materialData = new FormData();
      materialData.append('name', name);
      // in the quotation marks "file", we refer to the name we assigned in multer single function
      // the 3rd argument is the filename we pass to the backend
      materialData.append('filePath', filePath as File, name.split('.')[0]);
      materialData.append('fileType', (filePath as File).type);
      materialData.append('assignmentId', assignmentId);
      materialData.append('courseId', courseId);
    } else {
      materialData = {
        id,
        name,
        filePath,
        fileType,
        courseId,
        assignmentId,
      };
    }

    return this.http.put<{ message: string; updatedMaterial: Material }>(
      `${BACKEND_URL}/${currentMaterial.courseId}/assignments/${assignmentId}/materials`,
      materialData,
      {
        withCredentials: true,
      }
    );
  }

  deleteAssignmentMaterial(material: Material) {

    return this.http.delete(
      `${BACKEND_URL}/${material.courseId}/assignments/${material.assignmentId}/materials/${material.id}`,
      {
        withCredentials: true,
      }
    );
  }

  downloadAssignmentMaterial(material: Material) {
    const filePath = (material.filePath as string).split('/').slice(-1).pop();
    return this.http.post(
      `${BACKEND_URL}/${material.courseId}/assignments/${material.assignmentId}/materials/${material.id}/dump`,
      { filePath },
      { responseType: 'blob' as 'json', withCredentials: true }
    );
  }

  //   // for reading doc files
  //   readFile(filePath: string) {
  //     return this.http.post(
  //       `${BACKEND_URL}/fetch`,
  //       { filePath: filePath },
  //       {
  //         responseType: 'blob',
  //         headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
  //         withCredentials: true,
  //       }
  //     );
  //   }
}
