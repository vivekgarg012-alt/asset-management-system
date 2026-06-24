import { Component, OnInit } from '@angular/core';
import { NotificationService } from '../../core/services/notification.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-main-layout',
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.scss']
})
export class MainLayoutComponent implements OnInit {
  toast$: Observable<{ message: string; type: string } | null>;

  constructor(private notificationService: NotificationService) {
    this.toast$ = this.notificationService.toast$;
  }

  ngOnInit(): void {}
}
