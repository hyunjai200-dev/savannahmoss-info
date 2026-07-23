(function () {
  'use strict';

  var ENDPOINT = 'https://sxnxpjqaxuvuxhxgzcyn.supabase.co/functions/v1/submit-public-form';
  var ERROR_MESSAGES = {
    invalid_email: '이메일 주소를 다시 확인해주세요.',
    invalid_length: '입력한 내용의 길이를 확인해주세요.',
    invalid_choice: '필수 선택 항목을 확인해주세요.',
    consent_required: '필수 동의 항목을 확인해주세요.',
    rate_limited: '요청이 너무 많습니다. 한 시간 뒤 다시 시도해주세요.',
    payload_too_large: '입력 내용이 너무 깁니다. 내용을 줄여 다시 시도해주세요.',
    server_error: '지금은 제출할 수 없습니다. 잠시 후 다시 시도해주세요.',
  };

  function setDialogState() {
    document.body.classList.toggle('dialog-open', Boolean(document.querySelector('dialog[open]')));
  }

  function setStatus(form, message, isError) {
    var status = form.querySelector('.form-status');
    status.textContent = message;
    status.classList.toggle('is-error', Boolean(isError));
  }

  function prepareDialog(dialog, inquiryType) {
    var form = dialog.querySelector('form');
    form.querySelector('[name="startedAt"]').value = String(Date.now());
    setStatus(form, '', false);

    if (inquiryType && form.elements.inquiryType) {
      form.elements.inquiryType.value = inquiryType;
      updateOrganizationField(form);
    }
  }

  function updateOrganizationField(form) {
    var organizationField = form.querySelector('[data-organization-field]');
    if (!organizationField || !form.elements.inquiryType) return;
    var type = form.elements.inquiryType.value;
    organizationField.hidden = !(type === 'business' || type === 'church_organization');
  }

  function selectedValues(formData, name) {
    return formData.getAll(name).map(String);
  }

  function validateChoiceGroups(form, formData) {
    var groups = form.querySelectorAll('[data-required-group]');
    var valid = true;

    groups.forEach(function (group) {
      var name = group.getAttribute('data-required-group');
      var empty = selectedValues(formData, name).length === 0;
      group.classList.toggle('group-error', empty);
      if (empty && valid) {
        valid = false;
        group.focus();
      }
    });

    if (!valid) setStatus(form, '표시된 필수 선택 항목을 확인해주세요.', true);
    return valid;
  }

  function formPayload(form) {
    var data = new FormData(form);
    var base = {
      formType: form.getAttribute('data-form-type'),
      name: String(data.get('name') || ''),
      email: String(data.get('email') || ''),
      preferredLanguage: String(data.get('preferredLanguage') || ''),
      privacyConsent: data.get('privacyConsent') === 'on',
      website: String(data.get('website') || ''),
      startedAt: Number(data.get('startedAt')),
      sourcePage: window.location.pathname,
    };

    if (base.formType === 'contact') {
      return Object.assign(base, {
        inquiryType: String(data.get('inquiryType') || ''),
        organization: String(data.get('organization') || ''),
        message: String(data.get('message') || ''),
      });
    }

    return Object.assign(base, {
      platforms: selectedValues(data, 'platforms'),
      region: String(data.get('region') || ''),
      interests: selectedValues(data, 'interests'),
      deviceModel: String(data.get('deviceModel') || ''),
      osVersion: String(data.get('osVersion') || ''),
      motivation: String(data.get('motivation') || ''),
      age18Confirmed: data.get('age18Confirmed') === 'on',
      participationConfirmed: data.get('participationConfirmed') === 'on',
      betaTermsConsent: data.get('betaTermsConsent') === 'on',
      interviewOptIn: data.get('interviewOptIn') === 'on',
    });
  }

  function showBetaSuccess(form) {
    var formDialog = form.closest('dialog');
    var successDialog = document.getElementById('beta-success-dialog');
    if (!successDialog) return;

    if (formDialog && formDialog.open) formDialog.close();
    successDialog.showModal();
    setDialogState();
  }

  document.querySelectorAll('[data-open-dialog]').forEach(function (button) {
    button.addEventListener('click', function () {
      var dialog = document.getElementById(button.getAttribute('data-open-dialog'));
      if (!dialog) return;
      prepareDialog(dialog, button.getAttribute('data-inquiry-type'));
      dialog.showModal();
      setDialogState();
    });
  });

  document.querySelectorAll('.form-dialog').forEach(function (dialog) {
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', setDialogState);
    dialog.querySelectorAll('[data-dialog-close]').forEach(function (button) {
      button.addEventListener('click', function () {
        dialog.close();
      });
    });
  });

  document.querySelectorAll('[data-required-group] input').forEach(function (input) {
    input.addEventListener('change', function () {
      input.closest('[data-required-group]').classList.remove('group-error');
    });
  });

  var inquiryType = document.getElementById('inquiry-type');
  if (inquiryType) {
    inquiryType.addEventListener('change', function () {
      updateOrganizationField(inquiryType.form);
    });
    updateOrganizationField(inquiryType.form);
  }

  document.querySelectorAll('.public-form').forEach(function (form) {
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      var data = new FormData(form);
      if (!validateChoiceGroups(form, data)) return;

      var button = form.querySelector('.form-submit');
      var originalLabel = button.textContent;
      button.disabled = true;
      button.textContent = '보내는 중...';
      setStatus(form, '안전하게 내용을 전달하고 있습니다.', false);

      try {
        var response = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formPayload(form)),
        });
        var result = await response.json().catch(function () { return {}; });
        if (!response.ok || !result.ok) {
          throw new Error(result.error || 'server_error');
        }

        var formType = form.getAttribute('data-form-type');
        var successMessage = formType === 'beta'
          ? '신청이 접수되었습니다. 선정 안내는 입력한 이메일로 보내드릴게요.'
          : '문의가 접수되었습니다. 확인 후 입력한 이메일로 답변드릴게요.';
        form.reset();
        form.querySelector('[name="startedAt"]').value = String(Date.now());
        updateOrganizationField(form);
        if (formType === 'beta') {
          setStatus(form, '', false);
          showBetaSuccess(form);
        } else {
          setStatus(form, successMessage, false);
        }
      } catch (error) {
        var code = error instanceof Error ? error.message : 'server_error';
        setStatus(form, ERROR_MESSAGES[code] || ERROR_MESSAGES.server_error, true);
      } finally {
        button.disabled = false;
        button.textContent = originalLabel;
      }
    });
  });

})();
