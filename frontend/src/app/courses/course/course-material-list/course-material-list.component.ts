import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import {
  ControlContainer,
  FormGroup,
  FormControl,
  FormArray,
} from '@angular/forms';
import { Subscription } from 'rxjs';
import { saveAs } from 'file-saver';
import { MatTableDataSource } from '@angular/material/table';
import { Sort } from '@angular/material/sort';

import { Material } from 'src/app/models/material.model';
import { CourseMaterialsService } from './course-materials.service';
import { SharedService } from 'src/app//shared/services/shared.service';
// import { AssignmentsService } from '../../assignment.service';
import { environment } from 'src/environments/environment';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { PageEvent } from '@angular/material/paginator';

@Component({
  selector: 'app-course-material-list',
  styleUrls: ['./course-material-list.component.css'],
  templateUrl: './course-material-list.component.html',
})
export class CourseMaterialListComponent implements OnInit, OnDestroy {
  // @Input() assingnmentIndex: number;
  // private assignmentIdUpdateSub: Subscription;
  private materialUpdateSubscription: Subscription;
  // assignmentsForm: FormGroup;
  // currentAssignmentControl: FormControl;
  dataSource;
  displayedColumns: string[] = ['position', 'name', 'lastUpdate', 'options'];
  materials: Material[];
  courseId: string;
  assignmentId: string;
  isLoading: boolean = false;
  pageSizeOptions = environment.PAGE_SIZE_OPTIONS;
  totalMaterials = environment.TOTAL_COURSES;
  materialsPerPage = environment.COURSES_PER_PAGE;
  currentPage = environment.CURRENT_PAGE;

  constructor(
    // private controlContainer: ControlContainer,
    public route: ActivatedRoute,
    private courseMaterialService: CourseMaterialsService // private assignmentsService: AssignmentsService,
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe((paraMap: ParamMap) => {
      if (paraMap.has('courseId')) {
        this.courseId = paraMap.get('courseId');
      } else {
        throw new Error('no course id provided');
      }
    });

    this.materialUpdateSubscription = this.courseMaterialService
      .getCourseMaterialListener()
      .subscribe((materials) => {
        this.courseMaterialService
          .getCourseMaterials(
            this.materialsPerPage,
            this.currentPage,
            this.courseId
          )
          .subscribe((response) => {
            this.materials = response.materials;
            this.totalMaterials = response.maxMaterials;
            this.dataSource = new MatTableDataSource(this.materials);
          });
      });

    // fetch the materials
    this.courseMaterialService
      .getCourseMaterials(
        this.materialsPerPage,
        this.currentPage,
        this.courseId
      )
      .subscribe((response) => {
        this.materials = response.materials;
        this.totalMaterials = response.maxMaterials;
        this.dataSource = new MatTableDataSource(this.materials);
      });
  }

  ngOnDestroy() {
    // this.assignmentIdUpdateSub.unsubscribe();
    this.materialUpdateSubscription.unsubscribe();
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }

  // fetches the assignments sorted with regard the 'sort.active' value
  sortData(sort: Sort) {
    if (!sort.active || sort.direction === '') {
      this.materials = this.materials.slice();
      return;
    }

    this.isLoading = true;
    this.courseMaterialService
      .getCourseMaterials(
        this.materialsPerPage,
        this.currentPage,
        this.courseId,
        sort
      )
      .subscribe((response) => {
        // fetch the materials
        this.courseMaterialService
          .getCourseMaterials(
            this.materialsPerPage,
            this.currentPage,
            this.courseId
          )
          .subscribe((response) => {
            this.materials = response.materials;
            this.totalMaterials = response.maxMaterials;
            this.dataSource = new MatTableDataSource(this.materials);
          });
        this.isLoading = false;
      });
  }

  // deletes a material with regard it's index
  onDeleteCourseMaterial(material: Material, materialIndex: number) {
    this.isLoading = true;
    this.courseMaterialService.deleteCourseMaterial(material).subscribe(
      (response) => {
        // fetch the materials
        this.courseMaterialService
          .getCourseMaterials(
            this.materialsPerPage,
            this.currentPage,
            this.courseId
          )
          .subscribe((response) => {
            this.materials = response.materials;
            this.totalMaterials = response.maxMaterials;
            this.dataSource = new MatTableDataSource(this.materials);
          });
        this.isLoading = false;
      },
      (err) => {
        console.log(err);
        this.isLoading = false;
      }
    );
  }

  ondDownloadCourseMaterial(material: Material) {
    this.isLoading = true;
    this.courseMaterialService
      .downloadCourseMaterial(material)
      .subscribe((response: Blob) => {
        saveAs(response, material.name);
        this.isLoading = false;
      });
  }

  // fetches the assignments of the corresponding page of the pagination
  onChangePage(pageData: PageEvent) {
    this.isLoading = true;
    this.currentPage = pageData.pageIndex + 1;
    this.materialsPerPage = pageData.pageSize;
    this.courseMaterialService
      .getCourseMaterials(
        this.materialsPerPage,
        this.currentPage,
        this.courseId
      )
      .subscribe((response) => {
        this.dataSource = new MatTableDataSource(response.materials);
        this.isLoading = false;
      });
  }
}
