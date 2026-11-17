Rails.application.routes.draw do
  devise_for :users
  root to: "pages#home"

  resources :workout_plans

  resources :mentors, only: %i[index show] do
    member do
      patch :assign
    end
  end

  get "up" => "rails/health#show", as: :rails_health_check
end
