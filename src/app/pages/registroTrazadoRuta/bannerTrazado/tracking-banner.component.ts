import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TrackingService } from '../../../core/services/tracking.Service';
import { IonicModule } from '@ionic/angular';
import { ButtonModule } from "primeng/button";
import { Router } from '@angular/router';

@Component({
  selector: 'app-tracking-banner',
  templateUrl: './tracking-banner.component.html',
  styleUrls: ['./tracking-banner.component.css'],
  standalone: true,
  imports: [CommonModule, IonicModule, ButtonModule]
})
export class TrackingBannerComponent {
 

 isTracking$ = this.trackingService.isTrackingActive$();

  constructor(private trackingService: TrackingService, private router: Router) { }

  goToTracking() {
    this.router.navigate(['/recordTrazadoRuta']);
  }
}