import type { AdminCategoryRow } from "@brief/services";
import { Button, Group, Modal, Stack, Text, Title } from "@mantine/core";
import {
	keepPreviousData,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import classes from "#/components/admin/admin.module.css";
import { CategoriesTable } from "#/components/admin/categories-table";
import {
	type CategoryDialog,
	CategoryFormModal,
} from "#/components/admin/category-form-modal";
import {
	ADMIN_CATEGORIES_KEY,
	type AdminCategoriesSearch,
	adminCategoriesQueryOptions,
	adminCategoriesSearchSchema,
	deleteCategory,
	setCategoryEnabled,
} from "#/libs/api/admin-categories";
import { useI18n } from "#/libs/i18n/context";
import { readStoredLocale } from "#/libs/i18n/locale-cookie";
import { localisedTitle } from "#/libs/i18n/route-head";
import { notifyError, notifySuccess } from "#/libs/notify";

export const Route = createFileRoute("/admin/categories")({
	validateSearch: adminCategoriesSearchSchema,
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps }) => {
		const options = adminCategoriesQueryOptions(deps);

		if (import.meta.env.SSR) {
			// First render: wait, so the page arrives with its rows already in the
			// HTML and the component finds them in the cache on hydration.
			await context.queryClient.ensureQueryData(options);
		} else {
			// Paging, sorting and searching only warm the cache. Blocking here
			// would hold the navigation back and leave the table frozen without
			// its loading overlay, since the component would still be rendering
			// the previous search.
			void context.queryClient.prefetchQuery(options);
		}

		return { locale: readStoredLocale() };
	},
	head: localisedTitle((d) => d.auth.admin.categories.title),
	component: AdminCategoriesPage,
});

function AdminCategoriesPage() {
	const { t } = useI18n();
	const labels = t.auth.admin.categories;
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const queryClient = useQueryClient();

	const [dialog, setDialog] = useState<CategoryDialog | null>(null);
	const [pendingDeletion, setPendingDeletion] =
		useState<AdminCategoryRow | null>(null);

	const { data, isFetching, isError } = useQuery({
		...adminCategoriesQueryOptions(search),
		// Keeps the previous page on screen while the next one loads, instead of
		// collapsing the table on every keystroke or page change.
		placeholderData: keepPreviousData,
	});

	const handleSearchChange = useCallback(
		(patch: Partial<AdminCategoriesSearch>) => {
			void navigate({
				search: (previous) => ({ ...previous, ...patch }),
				// Typing must not leave one history entry per keystroke; paging and
				// sorting stay navigable with the back button.
				replace: "q" in patch,
			});
		},
		[navigate],
	);

	const refreshList = useCallback(
		() => queryClient.invalidateQueries({ queryKey: ADMIN_CATEGORIES_KEY }),
		[queryClient],
	);

	const toggleEnabled = useMutation({
		mutationFn: (category: AdminCategoryRow) =>
			setCategoryEnabled({
				data: { id: category.id, isEnable: !category.isEnable },
			}),
		onSuccess: async (_result, category) => {
			await refreshList();

			notifySuccess(
				category.isEnable
					? labels.notifications.disabled(category.name)
					: labels.notifications.enabled(category.name),
			);
		},
		onError: () => notifyError(t.auth.genericError),
	});

	const remove = useMutation({
		mutationFn: (category: AdminCategoryRow) =>
			deleteCategory({ data: { id: category.id } }),
		onSuccess: async (_result, category) => {
			await refreshList();
			setPendingDeletion(null);
			notifySuccess(labels.notifications.deleted(category.name));
		},
		onError: () => notifyError(t.auth.genericError),
	});

	const handleEdit = useCallback(
		(category: AdminCategoryRow) =>
			setDialog({ mode: "edit", id: category.id, name: category.name }),
		[],
	);

	const handleToggleEnabled = useCallback(
		(category: AdminCategoryRow) => toggleEnabled.mutate(category),
		[toggleEnabled],
	);

	const handleDelete = useCallback(
		(category: AdminCategoryRow) => setPendingDeletion(category),
		[],
	);

	return (
		<div className={classes.page}>
			<header>
				<Title order={1} size="h2" className={classes.heading}>
					{labels.title}
				</Title>
				<p className={classes.lead}>{labels.lead}</p>
			</header>

			<CategoriesTable
				search={search}
				result={data}
				isFetching={isFetching}
				isError={isError}
				onSearchChange={handleSearchChange}
				onCreate={() => setDialog({ mode: "create" })}
				onEdit={handleEdit}
				onToggleEnabled={handleToggleEnabled}
				onDelete={handleDelete}
				pendingActionId={
					toggleEnabled.isPending ? toggleEnabled.variables?.id : undefined
				}
			/>

			<CategoryFormModal dialog={dialog} onClose={() => setDialog(null)} />

			<Modal
				opened={Boolean(pendingDeletion)}
				onClose={() => setPendingDeletion(null)}
				title={labels.confirmDelete.title}
				centered
			>
				<Stack gap="lg">
					<Text size="sm">
						{pendingDeletion
							? labels.confirmDelete.body(pendingDeletion.name)
							: null}
					</Text>

					<Group justify="flex-end" gap="sm">
						<Button
							variant="default"
							onClick={() => setPendingDeletion(null)}
							disabled={remove.isPending}
						>
							{labels.confirmDelete.cancel}
						</Button>
						<Button
							color="red"
							loading={remove.isPending}
							onClick={() =>
								pendingDeletion ? remove.mutate(pendingDeletion) : undefined
							}
						>
							{labels.confirmDelete.confirm}
						</Button>
					</Group>
				</Stack>
			</Modal>
		</div>
	);
}
