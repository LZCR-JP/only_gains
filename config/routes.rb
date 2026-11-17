Rails.application.routes.draw do
  devise_for :users

  root to: "pages#home"

  resources :workout_plans do
    resources :chats, only: %i[create show]
  end

  resources :chats, only: [] do
    resources :messages, only: :create
  end

  resources :workout_change_proposals, only: [] do
    member do
      patch :accept
      patch :reject
    end
  end

  resources :mentors, only: %i[index show] do
    member do
      patch :assign
    end
  end

  get "up" => "rails/health#show", as: :rails_health_check
end