import {describe,it,expect} from 'vitest';
import {projectGlobe,canMapIndicator} from './globeProjection';
describe('globe projection',()=>{
 it('hides the rear hemisphere',()=>{expect(projectGlobe(0,0,0,0,100,200,200).visible).toBe(true);expect(projectGlobe(0,180,0,0,100,200,200).visible).toBe(false)});
 it('centers a selected country and applies radius once',()=>{const point=projectGlobe(30,35,-35,30,100,200,200);expect(point.x).toBeCloseTo(200);expect(point.y).toBeCloseTo(200);const normal=projectGlobe(0,45,0,0,100,0,0),zoomed=projectGlobe(0,45,0,0,150,0,0);expect(zoomed.x/normal.x).toBeCloseTo(1.5)});
 it('excludes invalid and unknown coordinates',()=>{expect(canMapIndicator({country:'XX',coordinates:[20,0]} as any)).toBe(false);expect(canMapIndicator({country:'US',coordinates:[NaN,0]} as any)).toBe(false);expect(canMapIndicator({country:'US',countryName:'United States',coordinates:[38,-97]} as any)).toBe(true)});
});
