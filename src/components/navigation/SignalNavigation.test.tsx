import {render,screen,fireEvent,within,cleanup} from '@testing-library/react';
import {beforeAll,afterEach,it,expect,vi} from 'vitest';
import SignalNavigation from './SignalNavigation';
import {getSignalTabs} from './signalPages';
import KeyboardShortcuts from '../KeyboardShortcuts';

beforeAll(()=>{
 HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};
 HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')};
});
afterEach(()=>{cleanup();vi.clearAllMocks()});
const open=()=>fireEvent.click(screen.getByRole('button',{name:/^Navigate/}));
it('only exposes the host-permitted destinations through both groups and search',()=>{
 render(<SignalNavigation activeTab="dashboard" allowedTabs={getSignalTabs('free',false)} onNavigate={vi.fn()}/>);open();
 const dialog=within(screen.getByRole('dialog'));expect(dialog.queryByRole('button',{name:/System control/})).toBeNull();
 const search=dialog.getByRole('searchbox');for(const text of ['admin','team','3d','social','osint']){fireEvent.change(search,{target:{value:text}});expect(dialog.getByText('No paths found.')).toBeTruthy()}
 fireEvent.change(search,{target:{value:'whois'}});expect(dialog.getByRole('button',{name:/Domain lookup/})).toBeTruthy();
});
it('navigates from Arabic search, closes the dialog and restores launcher focus',()=>{
 const navigate=vi.fn();render(<SignalNavigation activeTab="dashboard" allowedTabs={getSignalTabs('free',false)} onNavigate={navigate}/>);const launcher=screen.getByRole('button',{name:/^Navigate/});launcher.focus();open();
 const search=screen.getByRole('searchbox');fireEvent.change(search,{target:{value:'فحص البريد'}});fireEvent.keyDown(search,{key:'Enter'});
 expect(navigate).toHaveBeenCalledWith('email');expect(screen.queryByRole('dialog')).toBeNull();expect(document.activeElement).toBe(launcher);
});
it('closes on external route changes and cannot open while a host modal is active',()=>{
 const props={activeTab:'dashboard' as const,allowedTabs:getSignalTabs('enterprise',false),onNavigate:vi.fn()};const view=render(<SignalNavigation {...props}/>);open();expect(screen.getByRole('dialog')).toBeTruthy();view.rerender(<SignalNavigation {...props} activeTab="history"/>);expect(screen.queryByRole('dialog')).toBeNull();
 view.rerender(<SignalNavigation {...props} disabled/>);fireEvent.keyDown(window,{ctrlKey:true,key:'k'});expect(screen.queryByRole('dialog')).toBeNull();expect(screen.queryByRole('navigation')).toBeNull();
});
it('keeps the enterprise and administrator navigation groups distinct',()=>{
 expect(getSignalTabs('enterprise',false)).toEqual(expect.arrayContaining(['team','threat_3d']));expect(getSignalTabs('enterprise',false)).not.toContain('admin');
 const view=render(<SignalNavigation activeTab="admin" allowedTabs={getSignalTabs('free',true)} onNavigate={vi.fn()}/>);open();expect(within(screen.getByRole('dialog')).getByRole('button',{name:/System command center/})).toBeTruthy();view.unmount();
});
it('retired keyboard shortcuts cannot navigate, and shortcuts respect focused forms and dialogs',()=>{
 const navigate=vi.fn();render(<><KeyboardShortcuts enabled allowedTabs={getSignalTabs('free',false)} onNavigate={navigate}/><input aria-label="Example form"/><SignalNavigation activeTab="dashboard" allowedTabs={getSignalTabs('free',false)} onNavigate={navigate}/></>);
 for(const key of ['n','u','i','f','s','a'])fireEvent.keyDown(window,{ctrlKey:true,shiftKey:true,key});expect(navigate).not.toHaveBeenCalled();
 fireEvent.keyDown(screen.getByRole('textbox'),{ctrlKey:true,shiftKey:true,key:'e'});expect(navigate).not.toHaveBeenCalled();
 fireEvent.keyDown(window,{ctrlKey:true,shiftKey:true,key:'e'});expect(navigate).toHaveBeenCalledWith('email');navigate.mockClear();open();fireEvent.keyDown(window,{ctrlKey:true,shiftKey:true,key:'p'});expect(navigate).not.toHaveBeenCalled();
});
