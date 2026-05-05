import { useState, useCallback } from 'react';

export interface ValidationRule<T> {
  validate: (value: T) => boolean;
  message: string;
}

export interface FormValidation {
  [fieldName: string]: string[];
}

export function useFormValidation<T extends Record<string, any>>(
  onSubmit: (values: T) => void | Promise<void>,
) {
  const [values, setValues] = useState<T>({} as T);
  const [errors, setErrors] = useState<FormValidation>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setFieldValue = useCallback((field: keyof T, value: any) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const setFieldTouched = useCallback((field: keyof T, touched: boolean = true) => {
    setTouched((prev) => ({ ...prev, [field]: touched }));
  }, []);

  const setFieldError = useCallback((field: keyof T, error: string | null) => {
    setErrors((prev) => ({
      ...prev,
      [field]: error ? [error] : [],
    }));
  }, []);

  const validateField = useCallback(
    (field: keyof T, rules: ValidationRule<any>[]): boolean => {
      const value = values[field];
      const fieldErrors: string[] = [];

      rules.forEach((rule) => {
        if (!rule.validate(value)) {
          fieldErrors.push(rule.message);
        }
      });

      setErrors((prev) => ({
        ...prev,
        [field]: fieldErrors,
      }));

      return fieldErrors.length === 0;
    },
    [values],
  );

  const validateForm = useCallback(
    (rules: Record<keyof T, ValidationRule<any>[]>): boolean => {
      const newErrors: FormValidation = {};
      let isValid = true;

      Object.entries(rules).forEach(([field, fieldRules]) => {
        const fieldErrors: string[] = [];

        (fieldRules as ValidationRule<any>[]).forEach((rule) => {
          if (!rule.validate(values[field as keyof T])) {
            fieldErrors.push(rule.message);
            isValid = false;
          }
        });

        newErrors[field] = fieldErrors;
      });

      setErrors(newErrors);
      return isValid;
    },
    [values],
  );

  const handleSubmit = useCallback(
    async (rules: Record<keyof T, ValidationRule<any>[]>) => {
      return async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        if (!validateForm(rules)) return;

        setIsSubmitting(true);
        try {
          await onSubmit(values);
        } finally {
          setIsSubmitting(false);
        }
      };
    },
    [values, onSubmit, validateForm],
  );

  const resetForm = useCallback(() => {
    setValues({} as T);
    setErrors({});
    setTouched({});
  }, []);

  const hasErrors = Object.values(errors).some((fieldErrors) => fieldErrors.length > 0);

  return {
    values,
    errors,
    touched,
    isSubmitting,
    setFieldValue,
    setFieldTouched,
    setFieldError,
    validateField,
    validateForm,
    handleSubmit,
    resetForm,
    hasErrors,
  };
}

export function useFieldValidation<T>(
  initialValue: T,
  rules: ValidationRule<T>[],
) {
  const [value, setValue] = useState(initialValue);
  const [errors, setErrors] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);

  const validate = useCallback((val: T = value): boolean => {
    const fieldErrors: string[] = [];

    rules.forEach((rule) => {
      if (!rule.validate(val)) {
        fieldErrors.push(rule.message);
      }
    });

    setErrors(fieldErrors);
    return fieldErrors.length === 0;
  }, [rules, value]);

  const handleChange = useCallback((newValue: T) => {
    setValue(newValue);
    validate(newValue);
  }, [validate]);

  const handleBlur = useCallback(() => {
    setTouched(true);
    validate(value);
  }, [validate, value]);

  const isValid = errors.length === 0;
  const isDirty = value !== initialValue;

  return {
    value,
    setValue,
    errors,
    touched,
    isValid,
    isDirty,
    validate,
    handleChange,
    handleBlur,
    reset: () => {
      setValue(initialValue);
      setErrors([]);
      setTouched(false);
    },
  };
}
