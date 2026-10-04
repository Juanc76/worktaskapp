import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import {RecordTrazadoRutaComponent } from './recordTrazadoRuta.component';

describe('RecordTrazadoRutaComponent', () => {
  let component: RecordTrazadoRutaComponent;
  let fixture: ComponentFixture<RecordTrazadoRutaComponent>;
  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ RecordTrazadoRutaComponent ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(RecordTrazadoRutaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
