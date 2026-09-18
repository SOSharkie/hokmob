import {PickerMenuUtils} from "@shared/utils/picker-menu-utils";

describe('PickerMenuUtils', () => {

  describe('scrollToSelectedOption', () => {
    let menus: HTMLElement;

    beforeEach(() => {
      // Two open menus, as while one closes and another opens
      menus = document.createElement('div');
      menus.innerHTML =
          '<div class="pill-picker-menu year-menu">' +
          '  <button class="pill-picker-option">2026</button><button class="pill-picker-option selected">2015</button>' +
          '</div>' +
          '<div class="pill-picker-menu round-menu">' +
          '  <button class="pill-picker-option selected">Round 1</button>' +
          '</div>';
      document.body.appendChild(menus);
    });

    afterEach(() => {
      menus.remove();
    });

    it('should scroll to the selected option of the named menu only, after the panel renders', async () => {
      const scrollIntoView = spyOn(HTMLElement.prototype, 'scrollIntoView');
      PickerMenuUtils.scrollToSelectedOption('round-menu');
      expect(scrollIntoView).not.toHaveBeenCalled();

      await new Promise(resolve => setTimeout(resolve));
      expect(scrollIntoView).toHaveBeenCalledOnceWith({block: 'nearest'});
      expect(scrollIntoView.calls.mostRecent().object).toBe(menus.querySelector('.round-menu .selected'));
    });

    it('should do nothing when the menu has no selected option', async () => {
      menus.querySelector('.year-menu .selected').classList.remove('selected');
      const scrollIntoView = spyOn(HTMLElement.prototype, 'scrollIntoView');
      PickerMenuUtils.scrollToSelectedOption('year-menu');
      await new Promise(resolve => setTimeout(resolve));
      expect(scrollIntoView).not.toHaveBeenCalled();
    });
  });
});
