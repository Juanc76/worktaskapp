import { Component, OnInit } from '@angular/core';
import { IonicModule } from '@ionic/angular';

import { DatabaseService } from './core/services/database.service';
import { TrackingService } from './core/services/tracking.Service';
//import { TrackingBannerComponent } from './pages/registroTrazadoRuta/bannerTrazado/tracking-banner.component';
//import { AsyncPipe } from '@angular/common';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [IonicModule, 
    //TrackingBannerComponent, AsyncPipe
    ],
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent implements OnInit {
 
isTracking$ = this.trackingService.isTracking$();
  constructor(
    private dbService: DatabaseService,
    private trackingService: TrackingService
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      await this.dbService.init();
      await this.trackingService.reactivateTrackingifNeeded();
    } catch (error) {
      console.error('Error inicializando DB/resume tracking:', error);
    }
  }
}

