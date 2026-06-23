import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { LandingComponent } from './landing.component';

describe('LandingComponent', () => {
  let component: LandingComponent;
  let fixture: ComponentFixture<LandingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ LandingComponent ],
      imports: [ RouterTestingModule ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(LandingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have initial isScrolled as false', () => {
    expect(component.isScrolled).toBeFalsy();
  });

  it('should update isScrolled on window scroll', () => {
    // Mock scroll event
    window.pageYOffset = 100;
    component.onWindowScroll();
    expect(component.isScrolled).toBeTruthy();

    window.pageYOffset = 10;
    component.onWindowScroll();
    expect(component.isScrolled).toBeFalsy();
  });
});
