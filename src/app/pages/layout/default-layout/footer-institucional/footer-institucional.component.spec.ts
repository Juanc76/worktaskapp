import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { FooterInstitucionalComponent } from './footer-institucional.component';

describe('FooterInstitucionalComponent', () => {
  let component: FooterInstitucionalComponent;
  let fixture: ComponentFixture<FooterInstitucionalComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [FooterInstitucionalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FooterInstitucionalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
