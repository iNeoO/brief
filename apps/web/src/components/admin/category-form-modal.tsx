import {
	CATEGORY_DESCRIPTION_MAX_LENGTH,
	CATEGORY_NAME_MAX_LENGTH,
	DEFAULT_LANGUAGE,
	LANGUAGE,
} from "@brief/common/constants";
import type { AdminCategoryDetail } from "@brief/services";
import {
	Alert,
	Button,
	Center,
	Group,
	Input,
	Loader,
	Modal,
	MultiSelect,
	SegmentedControl,
	Stack,
	Switch,
	Textarea,
	TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ADMIN_CATEGORIES_KEY,
	adminCategoryQueryOptions,
	type CategoryFormValues,
	createCategory,
	updateCategory,
} from "#/libs/api/admin-categories";
import { adminProvidersQueryOptions } from "#/libs/api/admin-providers";
import { LOCALE_LABELS } from "#/libs/i18n/config";
import { useI18n } from "#/libs/i18n/context";
import type { Dictionary } from "#/libs/i18n/dictionaries";
import { notifyError, notifySuccess } from "#/libs/notify";

export type CategoryDialog =
	| { mode: "create" }
	| { mode: "edit"; id: string; name: string };

const EMPTY_VALUES: CategoryFormValues = {
	name: "",
	description: "",
	language: DEFAULT_LANGUAGE,
	isEnable: true,
	providerIds: [],
};

export function CategoryFormModal({
	dialog,
	onClose,
}: {
	dialog: CategoryDialog | null;
	onClose: () => void;
}) {
	const { t } = useI18n();
	const labels = t.auth.admin.categories;

	const editedId = dialog?.mode === "edit" ? dialog.id : undefined;

	const detail = useQuery({
		...adminCategoryQueryOptions(editedId ?? ""),
		enabled: Boolean(editedId),
	});

	return (
		<Modal
			opened={Boolean(dialog)}
			onClose={onClose}
			title={
				dialog?.mode === "edit"
					? labels.form.editTitle
					: labels.form.createTitle
			}
			centered
		>
			{dialog?.mode === "edit" ? (
				detail.isError ? (
					<Alert color="red" variant="light">
						{labels.form.loadError}
					</Alert>
				) : detail.data ? (
					// Keyed by id so switching rows re-seeds the fields instead of
					// carrying the previous category's values over.
					<CategoryForm
						key={detail.data.id}
						initialValues={toFormValues(detail.data)}
						categoryId={detail.data.id}
						onClose={onClose}
					/>
				) : (
					<Center py="xl">
						<Loader size="sm" />
					</Center>
				)
			) : (
				<CategoryForm
					key="create"
					initialValues={EMPTY_VALUES}
					onClose={onClose}
				/>
			)}
		</Modal>
	);
}

const toFormValues = (detail: AdminCategoryDetail): CategoryFormValues => ({
	name: detail.name,
	description: detail.description,
	language: detail.language,
	isEnable: detail.isEnable,
	providerIds: detail.providerIds,
});

const validate = (labels: Dictionary["auth"]["admin"]["categories"]) => ({
	name: (value: string) => {
		if (!value.trim()) return labels.validation.nameRequired;

		return value.trim().length > CATEGORY_NAME_MAX_LENGTH
			? labels.validation.nameTooLong(CATEGORY_NAME_MAX_LENGTH)
			: null;
	},
	description: (value: string) => {
		if (!value.trim()) return labels.validation.descriptionRequired;

		return value.trim().length > CATEGORY_DESCRIPTION_MAX_LENGTH
			? labels.validation.descriptionTooLong(CATEGORY_DESCRIPTION_MAX_LENGTH)
			: null;
	},
});

function CategoryForm({
	initialValues,
	categoryId,
	onClose,
}: {
	initialValues: CategoryFormValues;
	categoryId?: string;
	onClose: () => void;
}) {
	const { t } = useI18n();
	const labels = t.auth.admin.categories;
	const queryClient = useQueryClient();

	const providers = useQuery(adminProvidersQueryOptions());

	const form = useForm<CategoryFormValues>({
		// Controlled, unlike the auth forms: the sources field shows a warning
		// that depends on the current value, which an uncontrolled form cannot
		// re-render on. Five fields in a modal make the cost irrelevant.
		mode: "controlled",
		initialValues,
		// Mirrors the server's zod rule; the server stays the real gate.
		validate: validate(labels),
	});

	const save = useMutation({
		mutationFn: async (values: CategoryFormValues) => {
			if (categoryId) {
				await updateCategory({ data: { ...values, id: categoryId } });
				return;
			}

			await createCategory({ data: values });
		},
		onSuccess: async (_result, values) => {
			await queryClient.invalidateQueries({ queryKey: ADMIN_CATEGORIES_KEY });

			if (categoryId) {
				await queryClient.invalidateQueries({
					queryKey: ["admin", "category", categoryId],
				});
			}

			notifySuccess(
				categoryId
					? labels.notifications.updated(values.name)
					: labels.notifications.created(values.name),
			);

			onClose();
		},
		onError: () => notifyError(t.auth.genericError),
	});

	const providerOptions = (providers.data ?? []).map((provider) => ({
		value: provider.id,
		label: provider.isEnabled
			? provider.name
			: labels.form.providersDisabled(provider.name),
	}));

	return (
		<form onSubmit={form.onSubmit((values) => save.mutate(values))}>
			<Stack gap="md">
				<TextInput
					label={labels.form.name}
					placeholder={labels.form.namePlaceholder}
					maxLength={CATEGORY_NAME_MAX_LENGTH}
					withAsterisk
					data-autofocus
					{...form.getInputProps("name")}
				/>

				<Textarea
					label={labels.form.description}
					placeholder={labels.form.descriptionPlaceholder}
					maxLength={CATEGORY_DESCRIPTION_MAX_LENGTH}
					autosize
					minRows={2}
					maxRows={5}
					withAsterisk
					{...form.getInputProps("description")}
				/>

				<Input.Wrapper
					label={labels.form.language}
					description={labels.form.languageHelp}
				>
					<SegmentedControl
						mt={4}
						fullWidth
						data={Object.values(LANGUAGE).map((language) => ({
							value: language,
							label: LOCALE_LABELS[language],
						}))}
						{...form.getInputProps("language")}
					/>
				</Input.Wrapper>

				<MultiSelect
					label={labels.form.providers}
					placeholder={labels.form.providersPlaceholder}
					data={providerOptions}
					disabled={providers.isPending}
					searchable
					clearable
					// Only a warning while it is true: a category with no source
					// silently produces an empty brief.
					description={
						form.getValues().providerIds.length === 0
							? labels.form.providersEmpty
							: undefined
					}
					{...form.getInputProps("providerIds")}
				/>

				<Switch
					label={labels.form.isEnable}
					description={labels.form.isEnableHelp}
					{...form.getInputProps("isEnable", { type: "checkbox" })}
				/>

				<Group justify="flex-end" gap="sm">
					<Button variant="default" onClick={onClose} disabled={save.isPending}>
						{labels.form.cancel}
					</Button>
					<Button type="submit" loading={save.isPending}>
						{categoryId ? labels.form.submitEdit : labels.form.submitCreate}
					</Button>
				</Group>
			</Stack>
		</form>
	);
}
